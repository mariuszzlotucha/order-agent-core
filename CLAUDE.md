# CLAUDE.md

Instrukcje dla Claude Code w repo `order-agent-core`. Dokladny opis projektu jest w `README.md`, plan w `ROADMAP.md`.

## Czym jest ten projekt

Agent LangChain.js (LangGraph `createReactAgent`) w NestJS. Odpowiada klientom na WhatsApp o status zamowienia. To repo zawiera tylko agenta, jego bundle (prompty i konfiguracje) i ewaluacje. Obsluga WhatsApp jest w osobnym repo.

## Komendy

- `npm run build` - kompilacja (`nest build`)
- `npm run lint` - ESLint
- `npm test` - Vitest
- `node --env-file=.env dist/main` - start lokalny (po buildzie)
- `npm run eval` - runner ewaluacji (jeszcze niezaimplementowany)

Po zmianach w `src/` uruchom `npm run build && npm run lint && npm test`.

## Architektura

- `src/api/` - `POST /agent/message`, `GET /health`, `ServiceTokenGuard`
- `src/agent/` - `AgentService` (buduje agenta per wersja bundla, filtr canary)
- `src/bundle-loader/` - ladowanie bundla z AWS Secrets Manager (alias) lub z `bundle/` (`BUNDLE_SOURCE=local`)
- `src/tools/` - narzedzia (`order_status`, `handoff_to_human`), `OrdersClient` (klasa abstrakcyjna, podmieniana mockiem w ewaluacjach)
- `bundle/` - prompty, opisy narzedzi, manifest (IP, wersjonowane jako calosc)
- `evals/` - zbiory testowe, rubryki, progi (IP)
- `pipeline/` - workflowy GitHub Actions

## Twarde zasady (nie lam bez wyraznej zgody)

1. **Zadnych promptow ani opisow narzedzi w kodzie `src/`.** Wszystko, co trafia do LLM, pochodzi z bundla.
2. **Nie loguj tresci bundla, promptow, `e.message` z bledow agenta ani pelnych numerow telefonow.** Uzywaj `Logger` z NestJS, nigdy `console.*` (regula ESLint `no-console`). Numery maskuj (`maskPhone`).
3. **Weryfikacja wlasciciela zamowienia zostaje w kodzie narzedzia** (`order-status.tool.ts`). Numer telefonu pochodzi z `config.configurable.phone`, nigdy z parametrow, ktore ustawia model.
4. **Odpowiedz "brak zamowienia" i "cudze zamowienie" musi byc identyczna.**
5. **Narzedzia zwracaja tylko pola potrzebne do odpowiedzi** i pozostaja tylko do odczytu. Nie dodawaj narzedzi zmieniajacych lub anulujacych zamowienia bez wyraznej decyzji.
6. **Nie wlaczaj tracingu** (LangSmith) ani nie dodawaj zewnetrznego logowania tresci rozmow.
7. **Nie dodawaj endpointow debug/config ani niczego, co zwraca zawartosc bundla.**
8. **Nie kopiuj zawartosci `bundle/` ani `evals/` do zewnetrznych narzedzi, issue, komentarzy w PR czy commit messages.** Raporty i komentarze CI zawieraja tylko wskazniki.
9. **Nie commituj `.env`, kluczy ani zdeszyfrowanych zbiorow ewaluacyjnych.**
10. **Nie zmieniaj zabezpieczen (guard tokenu, filtr canary, limity) bez wyraznego polecenia.**

## Konwencje i pulapki

- TypeScript przypiety do `~5.9` (typescript-eslint nie wspiera jeszcze 6.1+/7.x). Nie podbijaj bez sprawdzenia.
- `tsconfig`: `module` i `moduleResolution` = `node16`. Nie ustawiaj `"type": "module"` w `package.json` (NestJS zaklada CommonJS).
- Vitest nie obsluguje `emitDecoratorMetadata`. W testach tworz serwisy recznie (`new AgentService(...)`) albo dodaj `unplugin-swc`.
- `.env` jest ladowany przez `import 'dotenv/config'` na gorze `main.ts`. `BundleLoaderService` czyta `process.env` w polach klasy, wiec ta linia musi zostac pierwsza.
- Nazwy pakietow LangChain/LangGraph zmieniaja sie czesto. Przy bledach importu sprawdz aktualna dokumentacje zamiast zgadywac.
- Walidacja wejscia i wyjscia przez Zod. Nowe endpointy i narzedzia tez.
- Pliki w `bundle/` i `evals/` sa obecnie atrapami bez polskich znakow. Nie zamieniaj ich na "prawdziwe" tresci w tym repo bez polecenia.

## Zmiany w bundle

- Kazda zmiana w `bundle/` wymaga podbicia `version` w `bundle/manifest.yaml`.
- Canary z `manifest.yaml` musi wystepowac w `prompts/system.md` i nie moze byc placeholderem.
- Po zmianie promptu lub narzedzi dopisz przypadki w `evals/datasets/` i wpis w `CHANGELOG.md` (co i dlaczego).
- Testy bezpieczenstwa (`evals/datasets/security/`) nie moga slabnac. Mozna je tylko rozszerzac.

## Ewaluacje

- Testy deterministyczne (`tools_called`, `tools_forbidden`) sa wazniejsze niz oceny LLM-sedziego.
- Kazdy przypadek uruchamiany `runs_per_case` razy, wynik to wskaznik przejscia.
- Progi w `evals/thresholds.yaml`. Nie luzuj ich, zeby "przeszlo".

## CI/CD

- Workflowy zyja w `pipeline/` i sa kopiowane do `.github/workflows/`. Po zmianie jednego zsynchronizuj drugie.
- Galaz glowna to `main`.
- Nie dodawaj krokow, ktore wypisuja tresc bundla do logow.
- Aplikacja ma miec wylacznie `GetSecretValue`. Uprawnienia zapisu nalezą do pipeline'u.

## Styl pracy

- Zmiany male i ukierunkowane. Nie przebudowuj architektury bez pytania.
- Przy niepewnosci co do wersji API pakietu sprawdz `node_modules` lub dokumentacje.
- Komentarze i komunikaty w kodzie po polsku bez diakrytykow (zgodnie z istniejacymi plikami), nazwy w kodzie po angielsku.
