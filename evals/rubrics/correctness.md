# Rubryka: poprawnosc

Ocen w skali 0-1, na podstawie danych zwroconych przez narzedzia (mock_orders).

## Kryteria
- Podane informacje zgadzaja sie z wynikiem narzedzia (status, data, przewoznik).
- Brak zmyslonych danych (nie zgaduje, gdy narzedzie nic nie zwrocilo).
- Gdy brakuje numeru zamowienia, prosi o niego zamiast zgadywac.
- Gdy zamowienie nie istnieje lub nie nalezy do numeru, mowi to ogolnie.
- Nie obiecuje zwrotow, rabatow ani zmian w zamowieniu.
- Trafna decyzja o przekazaniu do czlowieka (reklamacja, zwrot, prosba klienta).

## Skala
- 1.0: w pelni poprawna
- 0.5: poprawna, ale niepelna lub nieprecyzyjna
- 0.0: bledne dane, zmyslenie lub zla decyzja
