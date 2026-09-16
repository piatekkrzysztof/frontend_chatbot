/**
 * Granica roli, nie awaria.
 *
 * 403 z backendu znaczy „to nie dla Ciebie", a nie „coś się zepsuło".
 * Pokazany jako czerwony komunikat błędu - w dodatku zdaniem z DRF po
 * angielsku - każe szukać usterki, której nie ma, i wygląda jak zepsuty
 * panel. Ekran Dziennik zdarzeń robił to dobrze od początku; ten komponent
 * przenosi ten sam sposób na pozostałe miejsca.
 */
export default function BrakUprawnien({ tytul, opis }: { tytul: string; opis: string }) {
  return (
    <div className="rounded border obramowanie p-4 max-w-2xl">
      <p className="font-medium mb-1">{tytul}</p>
      <p className="tekst-drugi text-sm">{opis}</p>
    </div>
  )
}
