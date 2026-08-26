/**
 * Warstwa wywolan do API: token w pamieci, odswiezanie, wygasniecie sesji.
 *
 * Kategoria ryzyka: DOSTEP. Token dostepu zyje teraz 15 minut, wiec wygasa
 * w trakcie normalnej pracy, a nie raz na dobe. Gdyby wymiana tokenu na nowy
 * przestala dzialac, panel wyrzucalby wszystkich co kwadrans -- i wygladaloby
 * to na losowa awarie, nie na blad w kodzie.
 *
 * `window.location.href` jest w jsdom tylko do odczytu, wiec podmieniamy cale
 * `window.location` na atrape. To jedyny sposob, zeby sprawdzic przekierowanie
 * bez uruchamiania prawdziwej przegladarki.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, authHeaders } from '@/lib/api'
import { odswiezSesje, pobierzToken, ustawToken, wyloguj, zapomnijToken } from '@/lib/auth'

const oryginalnaLokalizacja = window.location

function podmienLokalizacje() {
  const atrapa = { href: '' } as Location
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: atrapa })
  return atrapa
}

function odpowiedz(status: number, cialo: unknown = {}, opcje: { pusta?: boolean } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: `HTTP ${status}`,
    json: opcje.pusta ? () => Promise.reject(new Error('brak JSON')) : () => Promise.resolve(cialo),
  } as Response
}

/** Skrot na czeste ustawienie: pierwsze zadanie 401, odswiezenie dziala. */
function sesjaDaSieOdnowic(poOdswiezeniu: Response) {
  vi.mocked(fetch)
    .mockResolvedValueOnce(odpowiedz(401))
    .mockResolvedValueOnce(odpowiedz(200, { access: 'swiezy-token' }))
    .mockResolvedValueOnce(poOdswiezeniu)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  zapomnijToken()
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: oryginalnaLokalizacja,
  })
  vi.unstubAllGlobals()
})

describe('token w pamieci', () => {
  it('nie zostawia niczego w localStorage', () => {
    // Cala istota tej przebudowy. Token w localStorage czyta dowolny skrypt
    // dzialajacy na stronie i przezywa on zamkniecie karty.
    ustawToken('abc')

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(pobierzToken()).toBe('abc')
  })

  it('usuwa token zostawiony przez poprzednia wersje', async () => {
    // Uzytkownik zalogowany przed przebudowa ma w localStorage token
    // odswiezania wazny jeszcze dwa tygodnie. Samo nieuzywanie go nie
    // wystarcza -- lezalby dalej, czytelny dla kazdego skryptu, i cala ta
    // zmiana minelaby sie z celem dla wszystkich dotychczas zalogowanych.
    localStorage.setItem('token', 'stary-access')
    localStorage.setItem('refresh_token', 'stary-refresh')

    // Sprzatanie dzieje sie przy wczytaniu modulu, wiec wczytujemy go od nowa.
    vi.resetModules()
    await import('@/lib/auth')

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('nie wystawia naglowka, gdy tokenu nie ma', () => {
    expect(authHeaders()).toEqual({})
  })

  it('wystawia naglowek Bearer, gdy token jest', () => {
    ustawToken('abc')

    expect(authHeaders()).toEqual({ Authorization: 'Bearer abc' })
  })
})

describe('odswiezanie sesji', () => {
  it('wymienia ciasteczko na nowy token dostepu', async () => {
    vi.mocked(fetch).mockResolvedValue(odpowiedz(200, { access: 'swiezy-token' }))

    const token = await odswiezSesje()

    expect(token).toBe('swiezy-token')
    const [adres, opcje] = vi.mocked(fetch).mock.calls[0]
    expect(String(adres)).toContain('/accounts/token/refresh/')
    // Bez tego przegladarka nie doklei ciasteczka do zapytania miedzy
    // panel.* a api.*, wiec odswiezanie ZAWSZE zwracaloby 401.
    expect(opcje?.credentials).toBe('include')
  })

  it('nie wysyla tokenu odswiezania w tresci', async () => {
    // Gdyby tu cokolwiek szlo, znaczyloby to, ze kod jednak zna ten token --
    // czyli ze gdzies go trzyma.
    vi.mocked(fetch).mockResolvedValue(odpowiedz(200, { access: 'x' }))

    await odswiezSesje()

    expect(vi.mocked(fetch).mock.calls[0][1]?.body).toBeUndefined()
  })

  it('zwraca null zamiast rzucac, gdy sesji juz nie ma', async () => {
    // Wygasla sesja jest sytuacja normalna, nie awaryjna. Wyjatek kazalby
    // kazdemu wywolujacemu opakowywac to w try/catch.
    vi.mocked(fetch).mockResolvedValue(odpowiedz(401))

    await expect(odswiezSesje()).resolves.toBeNull()
  })

  it('rownolegle wywolania daja JEDNO zapytanie', async () => {
    // Backend rotuje token przy kazdym odswiezeniu i uniewaznia poprzedni.
    // Piec zapytan naraz znaczyloby, ze cztery odpowiedzi niosa juz martwy
    // token -- sesja rozpadalaby sie dokladnie wtedy, gdy mialo jej przybyc
    // zycia, i to tylko przy kilku ekranach montujacych sie jednoczesnie.
    vi.mocked(fetch).mockResolvedValue(odpowiedz(200, { access: 'swiezy-token' }))

    const wyniki = await Promise.all([odswiezSesje(), odswiezSesje(), odswiezSesje()])

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    expect(wyniki).toEqual(['swiezy-token', 'swiezy-token', 'swiezy-token'])
  })
})

describe('wygasly token dostepu', () => {
  it('odswieza sesje i powtarza zadanie, zamiast wyrzucac', async () => {
    // To jest scenariusz z zycia: kwadrans pracy i pierwsze klikniecie
    // po wygasnieciu tokenu. Uzytkownik nie ma prawa tego zauwazyc.
    const lokalizacja = podmienLokalizacje()
    ustawToken('wygasly')
    sesjaDaSieOdnowic(odpowiedz(200, { wynik: 'ok' }))

    const dane = await apiFetch('/analytics/')

    expect(dane).toEqual({ wynik: 'ok' })
    expect(lokalizacja.href).toBe('')
  })

  it('powtorzone zadanie niesie juz NOWY token', async () => {
    // Powtorzenie ze starym tokenem odbiloby sie drugi raz -- test samego
    // faktu powtorzenia przepuscilby taka wersje.
    ustawToken('wygasly')
    sesjaDaSieOdnowic(odpowiedz(200, {}))

    await apiFetch('/analytics/')

    const [, opcje] = vi.mocked(fetch).mock.calls[2]
    expect((opcje?.headers as Headers).get('Authorization')).toBe('Bearer swiezy-token')
  })

  it('powtarza tylko raz', async () => {
    // Gdyby swiezy token tez wracal z 401, ponawianie w kolko zamienia
    // wygasla sesje w atak na wlasny backend.
    podmienLokalizacje()
    ustawToken('wygasly')
    vi.mocked(fetch)
      .mockResolvedValueOnce(odpowiedz(401))
      .mockResolvedValueOnce(odpowiedz(200, { access: 'swiezy-token' }))
      .mockResolvedValue(odpowiedz(401))

    await expect(apiFetch('/analytics/')).rejects.toThrow(/Sesja wygasła/)

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3)
  })

  it('gdy odswiezenie sie nie uda, czysci token i odsyla do logowania', async () => {
    const lokalizacja = podmienLokalizacje()
    ustawToken('wygasly')
    vi.mocked(fetch).mockResolvedValueOnce(odpowiedz(401)).mockResolvedValue(odpowiedz(401))

    await expect(apiFetch('/accounts/me/')).rejects.toThrow(/Sesja wygasła/)

    expect(pobierzToken()).toBeNull()
    // Parametr `wygasla` mowi proxy, ze sesja wlasnie umarla, wiec ma NIE
    // odbijac tego powrotu do panelu mimo wciaz lezacego znacznika sesji.
    // Bez niego przegladarka kreci sie w petli: panel na logowanie,
    // logowanie z powrotem do panelu, az do bledu "zbyt wiele przekierowan".
    expect(lokalizacja.href).toBe('/login?wygasla=1')
  })

  it('403 nie przekierowuje i nie odswieza', async () => {
    // 403 znaczy "nie masz uprawnien", nie "zaloguj sie ponownie".
    // Rola viewer dostaje 403 przy kazdej probie zapisu -- odswiezanie
    // sesji przy kazdym takim odbiciu byloby ruchem bez celu.
    const lokalizacja = podmienLokalizacje()
    ustawToken('wazny')
    vi.mocked(fetch).mockResolvedValue(odpowiedz(403, { detail: 'Brak uprawnień' }))

    await expect(apiFetch('/knowledge/')).rejects.toThrow('Brak uprawnień')

    expect(pobierzToken()).toBe('wazny')
    expect(lokalizacja.href).toBe('')
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })
})

describe('zadanie', () => {
  it('doklada token i ciasteczka do naglowkow', async () => {
    ustawToken('abc')
    vi.mocked(fetch).mockResolvedValue(odpowiedz(200, { ok: true }))

    await apiFetch('/analytics/')

    const [, opcje] = vi.mocked(fetch).mock.calls[0]
    expect((opcje?.headers as Headers).get('Authorization')).toBe('Bearer abc')
    expect(opcje?.credentials).toBe('include')
  })

  it('NIE ustawia Content-Type dla FormData', async () => {
    // Przegladarka musi sama dopisac granice multipart. Ustawienie
    // Content-Type recznie zabiera jej te mozliwosc i backend dostaje
    // wieloczesciowe cialo, ktorego nie potrafi rozlozyc -- wgrywanie
    // dokumentow przestaje dzialac bez zadnego komunikatu.
    const dane = new FormData()
    dane.append('file', new Blob(['x']), 'plik.pdf')
    vi.mocked(fetch).mockResolvedValue(odpowiedz(200, {}))

    await apiFetch('/documents-upload/', { method: 'POST', body: dane })

    const [, opcje] = vi.mocked(fetch).mock.calls[0]
    expect((opcje?.headers as Headers).has('Content-Type')).toBe(false)
  })

  it('ustawia Content-Type dla ciala JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(odpowiedz(200, {}))

    await apiFetch('/faq/', { method: 'POST', body: JSON.stringify({ question: 'x' }) })

    const [, opcje] = vi.mocked(fetch).mock.calls[0]
    expect((opcje?.headers as Headers).get('Content-Type')).toBe('application/json')
  })

  it('zwraca null przy 204, zamiast wywracac sie na pustym ciele', async () => {
    vi.mocked(fetch).mockResolvedValue(odpowiedz(204, null, { pusta: true }))

    await expect(apiFetch('/faq/1/', { method: 'DELETE' })).resolves.toBeNull()
  })

  it('wyciaga komunikat bledu z odpowiedzi backendu', async () => {
    vi.mocked(fetch).mockResolvedValue(odpowiedz(400, { detail: 'Limit wiadomości wyczerpany' }))

    await expect(apiFetch('/widget/chat/')).rejects.toThrow('Limit wiadomości wyczerpany')
  })

  it('nie gubi bledu, gdy odpowiedz nie jest JSON-em', async () => {
    // Przy 502 od proxy cialo bywa strona HTML. Bez zabezpieczenia
    // uzytkownik dostaje "Unexpected token <" zamiast informacji o awarii.
    vi.mocked(fetch).mockResolvedValue(odpowiedz(502, null, { pusta: true }))

    await expect(apiFetch('/analytics/')).rejects.toThrow('HTTP 502')
  })
})

describe('wylogowanie', () => {
  it('pyta backend, a nie tylko czysci pamiec', async () => {
    // Samo zapomnienie tokenu zostawiloby ciasteczko na miejscu, a token
    // odswiezania dzialalby dalej przez dwa tygodnie.
    ustawToken('abc')
    vi.mocked(fetch).mockResolvedValue(odpowiedz(204, null, { pusta: true }))

    await wyloguj()

    const [adres, opcje] = vi.mocked(fetch).mock.calls[0]
    expect(String(adres)).toContain('/accounts/logout/')
    expect(opcje?.credentials).toBe('include')
    expect(pobierzToken()).toBeNull()
  })

  it('czysci pamiec takze wtedy, gdy backend nie odpowiada', async () => {
    // Uzytkownik kliknal "wyloguj" i ma zostac wylogowany, nawet jesli
    // siec akurat padla. Token zostawiony w pamieci dzialalby dalej.
    ustawToken('abc')
    vi.mocked(fetch).mockRejectedValue(new Error('siec padla'))

    await wyloguj()

    expect(pobierzToken()).toBeNull()
  })
})
