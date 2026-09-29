# Roadmapa order-agent-core

Legenda: [ ] do zrobienia, [x] zrobione. Priorytety: P0 (blokuje start), P1 (przed produkcja), P2 (po starcie).

## Faza 0: Uruchomienie lokalne (P0)
- [ ] Ustawic `model.name` w `bundle/manifest.yaml` (obecnie `REPLACE_WITH_MODEL_NAME`)
- [ ] Wygenerowac losowy canary (`openssl rand -hex 16`) w `manifest.yaml` i `system.md`
- [ ] Dodac skrypty npm: `build` (`nest build`), `start` (`node dist/main`), `lint`, `test`, `eval`
- [ ] Naprawic ladowanie `.env`: `import 'dotenv/config'` w `main.ts` lub `node --env-file=.env`
- [ ] Zweryfikowac nazwy pakietow i importy LangChain/LangGraph (zmieniaja sie miedzy wersjami)
- [ ] Dopasowac `HttpOrdersClient` do prawdziwego API zamowien (zalozony endpoint `GET /orders/:id`)
- [ ] Pierwsze testy jednostkowe: weryfikacja wlasciciela zamowienia, filtr canary, walidacja wejscia

## Faza 1: Runner ewaluacji (P0)
- [ ] Napisac `npm run eval`: wczytanie datasetow, uruchomienie agenta z `BUNDLE_SOURCE=local`
- [ ] Mockowy `OrdersClient` z `mock_orders` (wstrzykiwany zamiast `HttpOrdersClient`)
- [ ] Powtarzanie przypadkow `runs_per_case` razy, liczenie bramek z `thresholds.yaml`
- [ ] Porownanie kandydat vs baseline `prod` (wskaznik `tool_regressions`)
- [ ] LLM-sedzia wg rubryk (`tone`, `correctness`, `security`), temperatura 0
- [ ] Zapis `evals/reports/summary.json` bez tresci promptow (`--redact-prompts`)
- [ ] Podmiana tokenu `$CANARY` wartoscia z manifestu
- [ ] Rozszerzyc zbiory: wielojezyczne, wieloturowe (dlugie rozmowy), wiecej technik injection
- [ ] Zastapic atrapy zanonimizowanymi, prawdziwymi rozmowami (szyfrowane SOPS)
- [ ] Uzupelnic krok SOPS w `eval.yml` (szkielet do dopasowania)

## Faza 2: CI/CD i secret manager (P0/P1)
- [ ] Skopiowac workflowy do `.github/workflows/` (lub trzymac je tam od poczatku)
- [ ] Ustawic zmienne repo: `AWS_ROLE_ARN`, `AWS_REGION`, `SECRET_ID`; sekrety: `SOPS_AGE_KEY`, `TEAM_WEBHOOK_URL`
- [ ] Utworzyc environmenty: `eval`, `staging` (zespol agenta), `production`, `production-rollback` (wymagane zatwierdzenie)
- [ ] Rola OIDC z minimalnymi uprawnieniami: `put-secret-value` i `update-secret-version-stage` tylko dla pipeline'u
- [ ] Aplikacja: wylacznie `GetSecretValue` na jeden sekret
- [ ] Osobny sekret per srodowisko (dev/staging/prod)
- [ ] Przypiac akcje CI do SHA commitow zamiast tagow
- [ ] Ochrona galezi `main`: 2 osoby na review zmian w `bundle/` i `evals/`, podpisane commity
- [ ] Wypelnic `CODEOWNERS` (wlasciciele `bundle/`, `evals/`, `pipeline/`)
- [ ] Dodac do `validate.yml` sprawdzenie, ze `.env` nie trafil do repo
- [ ] Pre-commit z gitleaks
- [ ] Testowe przejscie calej sciezki: PR -> eval -> staging -> promote -> rollback

## Faza 3: Ochrona IP (P1)
- [ ] Wyniesc prawdziwe prompty do prywatnego repo o waskim dostepie; developerom dawac atrapy i mock agenta
- [ ] Szyfrowanie sekretu wlasnym kluczem KMS (CMK) z osobnymi uprawnieniami
- [ ] Logi audytowe secret managera i alert przy odczycie spoza konta serwisowego
- [ ] Wylaczyc tracing (LangSmith) albo zostawic tylko self-hosted Langfuse dla zespolu agenta, ze zredagowanymi danymi
- [ ] Zero data retention u dostawcy LLM (jesli dostepne), osobny klucz produkcyjny z limitem wydatkow
- [ ] Watermarking promptow per srodowisko (ustalanie zrodla wycieku)
- [ ] Alert na canary w odpowiedziach (obecnie tylko log bledu)
- [ ] Kompilacja bez source maps, brak endpointow debug/config
- [ ] Umowy poufnosci i przeniesienia praw, takze dla freelancerow
- [ ] Konsultacja prawna nt. ochrony tajemnicy przedsiebiorstwa

## Faza 4: Infrastruktura produkcyjna (P1)
- [ ] `Dockerfile`: uzytkownik bez roota, system plikow tylko do odczytu, wylaczone core dumps, brak shella
- [ ] Serwis agenta bez publicznego adresu (private networking, mTLS lub token serwis-do-serwisu)
- [ ] Egress allowlist: tylko dostawca LLM, secret manager, API zamowien
- [ ] Osobne konto/projekt chmurowy dla agenta
- [ ] Rola IAM zamiast kluczy AWS; zmienne przez ECS/Kubernetes secrets, nie plik `.env`
- [ ] Podpisywanie obrazow kontenerow i deploy tylko podpisanych
- [ ] Skanowanie zaleznosci (npm audit, Dependabot/Renovate), lockfile
- [ ] Konto bazodanowe/API zamowien tylko do odczytu, najmniejszy zakres pol

## Faza 5: Stabilnosc i RODO (P1)
- [ ] Zastapic `MemorySaver` checkpointerem Postgres/Redis z retencja rozmow
- [ ] Redakcja numerow telefonow i tresci rozmow w logach i tracingu
- [ ] Egzekwowac `max_tool_calls_per_message` (obecnie tylko `recursionLimit`)
- [ ] Rate limiting per numer telefonu (np. `@nestjs/throttler` lub w serwisie WhatsApp)
- [ ] Limit tokenow, alert na anomalie kosztowe
- [ ] Idempotencja webhookow WhatsApp (zapis ID wiadomosci) i szybkie 200 z kolejka (repo serwisu WhatsApp)
- [ ] Weryfikacja podpisu Meta (repo serwisu WhatsApp)
- [ ] Zgodnosc z RODO: podstawa prawna, informacja dla klienta, procedura usuniecia danych

## Faza 6: Wdrozenie i monitoring (P2)
- [ ] Stopniowy rollout nowej wersji promptu: canary (maly procent ruchu) lub tryb cienia
- [ ] Monitoring po wdrozeniu: koszt, liczba przekazan do czlowieka, negatywne oceny
- [ ] Automatyczny lub szybki rollback aliasu przy pogorszeniu wskaznikow
- [ ] Test wycieku z zewnatrz (czy da sie wydobyc prompt) co kwartal
- [ ] Wypelnic `README.md` i `CHANGELOG.md` (co i dlaczego zmieniono w kazdej wersji bundla)

## Procesy i ludzie (ciagle)
- [ ] Zasada „break glass”: awaryjny dostep do prod z zatwierdzeniem i audytem
- [ ] Offboarding: automatyczne odbieranie dostepu (repo, CI, secret manager, tracing)
- [ ] Kwartalny przeglad uprawnien
- [ ] Plan reakcji na wyciek promptu (rotacja bundla, zmiana canary, ocena szkod)

## Zalozenia i ograniczenia
- Kto ma dostep do dzialajacego agenta lub produkcji, moze badac jego zachowanie. Pelnej ochrony nie ma, celem jest waski krag dostepu.
- Kluczowa logika biznesowa (weryfikacja wlasciciela zamowienia) jest w kodzie narzedzi, nie w prompcie.
- Pliki w `bundle/` i `evals/` sa obecnie atrapami.
- Pipeline zaklada GitHub Actions i AWS Secrets Manager.
