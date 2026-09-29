# CLAUDE.md

Instrukcje dla Claude Code w repo `order-agent-core`. Dokladny opis projektu jest w `README.md`, plan w `ROADMAP.md`.

## Czym jest ten projekt

Agent LangChain.js (LangGraph `createReactAgent`) w NestJS. Odpowiada klientom na WhatsApp o status zamowienia. To repo zawiera tylko agenta, jego bundle (prompty i konfiguracje) i ewaluacje. Obsluga WhatsApp jest w osobnym repo.

## Komendy

- `npm run build` - kompilacja (`nest build`)
- `npm run lint` - ESLint
- `npm test` - Vitest
- `npx vitest run <sciezka-do-pliku>` - jeden plik testowy; `npx vitest run -t "nazwa testu"` - jeden test po nazwie
- `node --env-file=.env dist/main` - start lokalny (po buildzie)
- `npm run eval` - runner ewaluacji, jeszcze niezaimplementowany: skrypt celowo konczy sie bledem (to nie awaria)

Po zmianach w `src/` uruchom `npm run build && npm run lint && npm test`.

Test reczny (po starcie lokalnym, `BUNDLE_SOURCE=local`):

```bash
curl -s -X POST localhost:3000/agent/message \
  -H "Authorization: Bearer $SERVICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"phone":"+48500000001","text":"Gdzie jest moje zamowienie #1234?"}'
```

Bez dzialajacego API zamowien narzedzie zwroci "chwilowy problem z systemem zamowien".

## Konfiguracja

Pelna lista zmiennych w `.env.example`. `BUNDLE_SOURCE=local` + `BUNDLE_DIR` sluzy do dev i ewaluacji, `secretsmanager` do staging/prod (`BUNDLE_ALIAS`: `dev`/`staging`/`prod`, `SECRET_ID`). `LANGSMITH_TRACING` musi zostac `false`.

## Architektura

- `src/api/` - `POST /agent/message`, `GET /health`, `ServiceTokenGuard`
- `src/agent/` - `AgentService` (buduje agenta per wersja bundla, filtr canary)
- `src/bundle-loader/` - ladowanie bundla z AWS Secrets Manager (alias) lub z `bundle/` (`BUNDLE_SOURCE=local`)
- `src/tools/` - narzedzia (`order_status`, `handoff_to_human`), `OrdersClient` (klasa abstrakcyjna, podmieniana mockiem w ewaluacjach)
- `bundle/` - prompty, opisy narzedzi, manifest (IP, wersjonowane jako calosc)
- `evals/` - zbiory testowe, rubryki, progi (IP)
- `pipeline/` - workflowy GitHub Actions

### Przeplyw requestu

1. Serwis WhatsApp (osobne repo) woła `POST /agent/message` z `{phone, text}`; `ServiceTokenGuard` sprawdza `SERVICE_TOKEN`, Zod waliduje body.
2. `AgentService` pobiera aktualny bundle (alias `dev`/`staging`/`prod`, odswiezany co `BUNDLE_REFRESH_SECONDS`, domyslnie 300 s) i buduje agenta `createReactAgent` + `ChatAnthropic` per wersja bundla.
3. `thread_id` = numer telefonu (pamiec rozmowy per klient). Telefon trafia do narzedzi wylacznie przez `config.configurable.phone`; model go nie widzi.
4. Odpowiedz przechodzi przez filtr canary i wraca jako `{reply}`. Bledy agenta zwracaja ogolny komunikat w `reply`.

### Znane ograniczenia (nie zakladaj, ze dzialaja)

- `MemorySaver` trzyma rozmowy tylko w pamieci procesu.
- `max_tool_calls_per_message` nie jest egzekwowany, dziala tylko `recursionLimit`.
- Brak rate limitingu i kolejki per numer (rownolegle wywolania na tym samym `thread_id`).
- `handoff_to_human` wysyla tylko webhook; agent nie przestaje odpowiadac w tej rozmowie.
- Tylko tekst; obrazy, glosowki i lokalizacje filtruje serwis WhatsApp.

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
- Pola przypadkow: `tools_called`, `tools_forbidden`, `response_must_contain_any`, `response_must_not_contain`. Token `$CANARY` jest podmieniany wartoscia z manifestu. LLM-sedzia wg rubryk `tone`, `correctness`, `security`.
- Twarde bramki: 0 regresji narzedzi, 0 wyciekow canary, 0 zakazanych wywolan, 100% testow bezpieczenstwa.

## CI/CD

- Workflowy zyja w `pipeline/` i sa kopiowane do `.github/workflows/`. Po zmianie jednego zsynchronizuj drugie.
- Galaz glowna to `main`.
- Workflowy: `validate` (kazdy PR: manifest, gitleaks, canary, lint, testy), `eval` (kazdy PR: nowa wersja vs `prod`), `publish-staging` (merge do `main` ze zmianami w `bundle/`), `promote-prod` i `rollback` (reczne, przesuwaja alias `prod`).
- Nie dodawaj krokow, ktore wypisuja tresc bundla do logow.
- Aplikacja ma miec wylacznie `GetSecretValue`. Uprawnienia zapisu nalezą do pipeline'u.

## Styl pracy

- Zmiany male i ukierunkowane. Nie przebudowuj architektury bez pytania.
- Przy niepewnosci co do wersji API pakietu sprawdz `node_modules` lub dokumentacje.
- Komentarze i komunikaty w kodzie po polsku bez diakrytykow (zgodnie z istniejacymi plikami), nazwy w kodzie po angielsku.
