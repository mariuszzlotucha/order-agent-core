import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { bundleSchema, LoadedBundle } from './bundle.types';

// BUNDLE_SOURCE=secretsmanager (domyslnie) albo local (dev/eval, czyta ./bundle)
// BUNDLE_ALIAS=prod|staging|dev, SECRET_ID=<nazwa sekretu>
// Nigdy nie logujemy tresci bundla, tylko id wersji.
@Injectable()
export class BundleLoaderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BundleLoaderService.name);
  private readonly source = process.env.BUNDLE_SOURCE ?? 'secretsmanager';
  private readonly alias = process.env.BUNDLE_ALIAS ?? 'prod';
  private readonly client = new SecretsManagerClient({});
  private loaded?: LoadedBundle;
  private timer?: NodeJS.Timeout;

  async onModuleInit() {
    // Start bez poprawnego bundla = blad, nie uruchamiamy agenta z pustym promptem
    await this.refresh();

    if (this.source === 'secretsmanager') {
      const seconds = Number(process.env.BUNDLE_REFRESH_SECONDS ?? 300);
      this.timer = setInterval(() => {
        this.refresh().catch((e) =>
          this.logger.error(`Odswiezenie bundla nieudane: ${e instanceof Error ? e.name : 'unknown'}`),
        );
      }, seconds * 1000);
      this.timer.unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  current(): LoadedBundle {
    if (!this.loaded) throw new Error('Bundle not loaded');
    return this.loaded;
  }

  private async refresh() {
    const next = this.source === 'local' ? await this.fromLocal() : await this.fromAws();
    if (this.loaded?.versionId !== next.versionId) {
      this.logger.log(`Zaladowano bundle: alias=${this.alias}, version=${next.versionId}`);
    }
    this.loaded = next;
  }

  private async fromAws(): Promise<LoadedBundle> {
    const secretId = process.env.SECRET_ID;
    if (!secretId) throw new Error('SECRET_ID is not set');

    const res = await this.client.send(
      new GetSecretValueCommand({ SecretId: secretId, VersionStage: this.alias }),
    );
    if (!res.SecretString || !res.VersionId) throw new Error('Empty secret');

    const bundle = bundleSchema.parse(JSON.parse(res.SecretString));
    return { versionId: res.VersionId, bundle };
  }

  private async fromLocal(): Promise<LoadedBundle> {
    const root = process.env.BUNDLE_DIR ?? join(process.cwd(), 'bundle');
    const read = (p: string) => readFile(join(root, p), 'utf8');

    const bundle = bundleSchema.parse({
      manifest: parse(await read('manifest.yaml')),
      prompts: {
        system: await read('prompts/system.md'),
        fewshot: await read('prompts/fewshot.md'),
      },
      tools: {
        order_status: await read('tools/order-status.description.md'),
        handoff_to_human: await read('tools/handoff.description.md'),
      },
    });
    return { versionId: 'local', bundle };
  }
}
