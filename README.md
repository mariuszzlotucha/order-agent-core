# order-agent-core

Agent LangChain.js (LangGraph) w NestJS, ktory odpowiada klientom na WhatsApp o status zamowienia. To repo zawiera **tylko agenta i cala jego konfiguracje (IP)**. Obsluga WhatsApp (webhook, podpis Meta, wysylka) jest w osobnym repo i rozmawia z agentem przez jeden endpoint.

**Repo jest prywatne, z waskim dostepem (tylko zespol agenta).**

## Spis tresci
1. Jak to dziala
2. Ustalenia projektowe
3. Struktura repo
4. Bundle i wersjonowanie
5. Ewaluacje
6. Pipeline CI/CD
7. Ochrona IP
8. Konfiguracja
9. Uruchomienie lokalne
10. Kontrakt API
11. Znane ograniczenia
12. Dalsze prace

## 1. Jak to dziala

1. Klient pisze na WhatsApp, np. "Gdzie jest moje zamowienie #1234?".
2. Serwis WhatsApp (osobne repo) odbiera webhook i wola `POST /agent/message` z numerem telefonu i tekstem.
3. `AgentService` ladzie aktualny bundle (prompty, opisy narzedzi, model, limity) z AWS Secrets Manager i buduje agenta (`createReactAgent` + `ChatAnthropic`).
4. Agent wybiera narzedzie `order_status`. Narzedzie pyta API zamowien i **w kodzie** sprawdza, czy numer telefonu pasuje do zamowienia.
5. Odpowiedz wraca do serwisu WhatsApp, ktory wysyla ja klientowi.

Narzedzia: `order_status` (tylko odczyt) i `handoff_to_human` (przekazanie do czlowieka).

## 2. Ustalenia projektowe

**Stack**
- NestJS + TypeScript, LangChain.js z LangGraph (`createReactAgent`), dostawca LLM: Anthropic.
- `thread_id` = numer telefonu (pamiec rozmowy per klient).
- TypeScript przypiety do 5.9 (typescript-eslint nie wspiera jeszcze 6.1+/7.x).
- `tsconfig`: `module` i `moduleResolution` = `node16` (wymagane przez `exports` w pakietach LangChain). Nie ustawiac `"type": "module"`.

**Podzial systemu**
- To repo: agent + bundle + ewaluacje + pipeline promptow.
- Osobne repo: serwis WhatsApp. Widzi tylko kontrakt `handleMessage(phone, text) -> reply`.
- Pozostali developerzy pracuja na **mocku agenta** (staly tekst), bez dostepu do prawdziwych promptow.

**Bezpieczenstwo logiki**
- Weryfikacja wlasciciela zamowienia jest w kodzie narzedzia, nie w prompcie.
- Numer telefonu trafia do narzedzi przez `config.configurable`. Model go nie widzi i nie moze podmienic.
- Odpowiedz dla "brak zamowienia" i "cudze zamowienie" jest identyczna (nie zdradzamy istnienia zamowienia).
- Narzedzia zwracaja tylko pola potrzebne do odpowiedzi.
- Agent nie ma uprawnien do zmiany ani anulowania zamowien.

**Ochrona IP** (szczegoly w sekcji 7)
- Prompty, opisy narzedzi, few-shot, model i parametry to jeden wersjonowany pakiet (bundle) trzymany w Secrets Managerze, nie w obrazie kontenera.
- Kontrola dostepu zamiast "ukrywania": kto ma dostep do dzialajacego agenta, moze badac jego zachowanie. Celem jest waski krag.

## 3. Struktura repo

````
order-agent-core/
├── bundle/                 # WARTOSC IP, wersjonowana jako calosc
│   ├── manifest.yaml       # wersja, model, limity, canary
│   ├── prompts/            # system.md, fewshot.md
│   └── tools/              # opisy narzedzi
├── src/                    # kod serwisu NestJS
│   ├── api/                # POST /agent/message, GET /health, guard tokenu
│   ├── agent/              # AgentService (LangGraph)
│   ├── bundle-loader/      # pobieranie bundla (Secrets Manager lub lokalnie)
│   └── tools/              # order_status, handoff, klient API zamowien
├── evals/                  # WARTOSC IP
│   ├── datasets/           # functional, edge-cases, security
│   ├── rubrics/            # kryteria dla LLM-sedziego
│   ├── thresholds.yaml     # progi przejscia
│   └── reports/            # wyniki (poza gitem)
├── pipeline/               # workflowy GitHub Actions (kopiowane do .github/workflows/)
├── .env.example            # dokumentacja zmiennych (w gicie)
├── .sops.yaml              # szyfrowanie zbiorow ewaluacyjnych
├── Dockerfile
├── CODEOWNERS
├── CHANGELOG.md
└── ROADMAP.md
````

Granica: **kod jest w `src/`, cala wartosc IP w `bundle/` i `evals/`**, ktore sa danymi. Obraz kontenera nie zawiera `bundle/` ani `evals/`.

## 4. Bundle i wersjonowanie

Wersjonujemy caly pakiet (prompt, opisy narzedzi, model, parametry) jako jedna jednostke. Zmiana modelu bez zmiany promptu tez zmienia zachowanie.

- Kazda publikacja to nowa, niezmienna wersja sekretu w AWS Secrets Manager.
- Aliasy (etykiety wersji): `dev`, `staging`, `prod`, `prod-previous`.
- Promocja to przesuniecie aliasu, rollback to przesuniecie z powrotem. Bez deployu kodu.
- Aplikacja przy starcie czyta **alias**, nie konkretna wersje, i odswieza go co `BUNDLE_REFRESH_SECONDS` (domyslnie 300 s).
- Zmiany tylko przez pull request (review wlasciciela, 2 osoby na `bundle/`), nigdy recznie w konsoli AWS.
- Wersja w `manifest.yaml` musi byc podbita w kazdym PR zmieniajacym bundle.
- Osobny sekret per srodowisko (dev / staging / prod).

Przeplyw zmiany promptu:
1. PR zmienia pliki w `bundle/` i podbija wersje w `manifest.yaml`.
2. `validate` sprawdza manifest, sekrety, canary, lint i testy.
3. `eval` porownuje nowa wersje z `prod` wg `thresholds.yaml`.
4. Po merge `publish-staging` zapisuje nowa wersje i ustawia alias `staging`.
5. Test na stagingu, opcjonalnie canary (maly procent ruchu) lub tryb cienia.
6. `promote-prod` (reczne zatwierdzenie) przesuwa alias `prod`. `rollback` cofa.

## 5. Ewaluacje

- **Testy deterministyczne** (najbardziej wiarygodne): czy agent wywolal wlasciwe narzedzie z wlasciwymi argumentami i nie wywolal zakazanego.
- **Sprawdzenia tekstu**: `response_must_contain_any`, `response_must_not_contain`. Token `$CANARY` jest podmieniany wartoscia z manifestu.
- **LLM-sedzia** wg rubryk `tone`, `correctness`, `security` (temperatura 0, 10% ocen do recznej weryfikacji).
- **Testy bezpieczenstwa**: wyciek promptu, zmiana roli, injection, cudzy numer telefonu.
- Kazdy przypadek uruchamiany `runs_per_case` razy (odpowiedzi LLM sa niedeterministyczne). Liczy sie wskaznik przejscia, nie pojedynczy przebieg.
- Twarde bramki: 0 regresji narzedzi, 0 wyciekow canary, 0 zakazanych wywolan, 100% testow bezpieczenstwa.
- Zbiory zawieraja realne rozmowy, wiec musza byc zanonimizowane i szyfrowane (SOPS). Obecne pliki to **atrapy**.
- Reszta zespolu widzi w CI tylko status i wskazniki, nie tresc promptow ani przypadkow.

## 6. Pipeline CI/CD

Zalozenia: GitHub Actions + AWS Secrets Manager. Pliki z `pipeline/` trzeba skopiowac do `.github/workflows/`.

| Workflow | Kiedy | Co robi |
|---|---|---|
| `validate` | kazdy PR | manifest, gitleaks, canary, lint, testy |
| `eval` | kazdy PR | nowa wersja vs `prod`, progi, komentarz ze wskaznikami |
| `publish-staging` | merge do `main` (zmiany w `bundle/`) | nowa wersja + alias `staging` |
| `promote-prod` | reczny | zatwierdzenie wlasciciela, alias `prod` |
| `rollback` | reczny, awaryjny | przesuniecie aliasu `prod` z audytem |

Wspolne zasady:
- Uwierzytelnienie do chmury przez OIDC (bez dlugo zyjacych kluczy).
- Sekrety tylko w chronionych galeziach i srodowiskach.
- W logach tylko numer wersji i hash, nigdy tresc bundla.
- Akcje przypiete do SHA commitow (docelowo).
- Rola pipeline'u: `put-secret-value` i `update-secret-version-stage`. Aplikacja: wylacznie `GetSecretValue` na jeden sekret.

## 7. Ochrona IP

**Repo i proces**
- Waski dostep, CODEOWNERS na `bundle/`, `evals/`, `pipeline/`.
- Ochrona galezi `main`, podpisane commity, 2 osoby na review `bundle/`.
- Pre-commit z gitleaks, zakaz commitowania `.env`.
- Umowy poufnosci i przeniesienia praw, takze dla freelancerow.
- Offboarding z automatycznym odbieraniem dostepu, kwartalny przeglad uprawnien.
- Zasada "break glass": awaryjny dostep do produkcji z zatwierdzeniem i audytem.

**Wszystko, co trafia do LLM, to IP**: opisy narzedzi, nazwy, schematy, few-shot, reguly, parametry. Wszystko to jest w bundlu, nie w kodzie.

**Runtime**
- Tracing (LangSmith) wylaczony: prompty i dane klientow trafilyby do zewnetrznego systemu.
- Logi nie zawieraja tresci bundla ani `e.message`. Regula ESLint `no-console` jest bledem.
- Canary w prompcie: filtr odpowiedzi podmienia odpowiedz i loguje alert, gdy canary sie pojawi.
- Brak endpointow debug/config. `/health` nic nie mowi o bundlu.
- Kontener bez roota, system plikow tylko do odczytu, wylaczone core dumps, brak shella.
- Serwis bez publicznego adresu. Autoryzacja serwis-do-serwisu przez `SERVICE_TOKEN`.
- Egress allowlist: tylko dostawca LLM, Secrets Manager, API zamowien.
- Szyfrowanie sekretu wlasnym kluczem KMS.
- Zero data retention u dostawcy LLM (jesli dostepne), osobny klucz produkcyjny z limitem wydatkow.

**Langfuse**: uzupelnienie, nie zamiennik. Prompty zostaja w Secrets Managerze. Ewentualnie self-hosted Langfuse tylko dla zespolu agenta, do tracingu i ewaluacji, ze zredagowanymi danymi osobowymi.

**Plan na wyciek**: rotacja bundla, zmiana canary, ocena szkod. Watermarking promptow per srodowisko pozwala ustalic zrodlo.

## 8. Konfiguracja

Zmienne opisane w `.env.example`. Lokalny `.env` nie trafia do gita.

| Zmienna | Opis |
|---|---|
| `SERVICE_TOKEN` | token serwis-do-serwisu (`openssl rand -hex 32`) |
| `ANTHROPIC_API_KEY` | klucz LLM (dev: osobny, z niskim limitem) |
| `BUNDLE_SOURCE` | `secretsmanager` (staging/prod) lub `local` (dev, eval) |
| `BUNDLE_ALIAS` | `prod`, `staging`, `dev` |
| `SECRET_ID` | nazwa sekretu w AWS |
| `BUNDLE_REFRESH_SECONDS` | odswiezanie bundla (domyslnie 300) |
| `BUNDLE_DIR` | katalog bundla przy `local` |
| `AWS_REGION` | region AWS |
| `ORDERS_API_URL`, `ORDERS_API_TOKEN` | API zamowien (konto tylko do odczytu) |
| `HANDOFF_WEBHOOK_URL` | opcjonalnie, zgloszenia do konsultanta |
| `LANGSMITH_TRACING` | zostaw `false` |

Na stagingu i produkcji nie uzywamy pliku `.env`: zmienne przez platforme (ECS/Kubernetes secrets), dostep do AWS przez role IAM.

## 9. Uruchomienie lokalne

````bash
npm ci
cp .env.example .env        # uzupelnij ANTHROPIC_API_KEY, ustaw BUNDLE_SOURCE=local
npm run build
node --env-file=.env dist/main
````

Test reczny:

````bash
curl -s -X POST localhost:3000/agent/message \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+48500000001","text":"Gdzie jest moje zamowienie #1234?"}'
````

Bez dzialajacego API zamowien narzedzie zwroci "chwilowy problem z systemem zamowien". Pelny test przez mock da runner ewaluacji.

Przed pierwszym uruchomieniem:
- ustaw `model.name` w `bundle/manifest.yaml`,
- wygeneruj losowy canary (`openssl rand -hex 16`) w `manifest.yaml` i `system.md`,
- zaloz sekret w AWS: `aws secretsmanager create-secret --name order-agent/staging --secret-string '{}'`.

Skrypty npm: `build`, `start`, `lint`, `test`, `eval` (runner jeszcze niezaimplementowany, skrypt celowo konczy sie bledem).

## 10. Kontrakt API

`POST /agent/message`
- Naglowek: `Authorization: Bearer <SERVICE_TOKEN>`
- Body: `{ "phone": "+48...", "text": "..." }` (telefon 6-15 cyfr, tekst 1-4000 znakow)
- Odpowiedz 200: `{ "reply": "..." }`
- Bledy: 400 (zle dane), 401 (zly token). Bledy agenta zwracaja ogolny komunikat w polu `reply`.

`GET /health` -> `{ "status": "ok" }`

## 11. Znane ograniczenia

- `MemorySaver` trzyma rozmowy tylko w pamieci procesu. Na produkcji Postgres/Redis z retencja (RODO).
- `max_tool_calls_per_message` nie jest wprost egzekwowany (tylko `recursionLimit`).
- Brak rate limitingu per numer telefonu.
- Brak kolejki per numer: dwie szybkie wiadomosci moga uruchomic rownolegle wywolania na tym samym `thread_id`.
- Agent obsluguje tylko tekst. Obrazy, glosowki i lokalizacje musi odfiltrowac serwis WhatsApp.
- Handoff wysyla tylko webhook. Ktos musi odebrac zgloszenie, a agent powinien przestac odpowiadac w tej rozmowie.
- Pliki w `bundle/` i `evals/` to atrapy bez polskich znakow. Na produkcji wpisz prawidlowe UTF-8.
- Nazwy pakietow i wersje LangChain/LangGraph zmieniaja sie czesto. Przy bledach importow sprawdz aktualna dokumentacje.

## 12. Dalsze prace

Pelna lista jest w [ROADMAP.md](ROADMAP.md). Najblizsze kroki: domkniecie fazy 0 (skrypty, canary, model), potem runner ewaluacji (`npm run eval`), bo od niego zalezy caly pipeline.
