(function () {
  var scriptTag = document.currentScript;
  if (!scriptTag) return;

  var apiKey = scriptTag.getAttribute('data-key');
  if (!apiKey) {
    console.error('[chatbot embed] Brak atrybutu data-key na tagu <script>.');
    return;
  }

  var position = scriptTag.getAttribute('data-position') === 'left' ? 'left' : 'right';
  var origin = new URL(scriptTag.src).origin;

  var isOpen = false;
  var iframe = null;
  var dymek = null;

  // Adres API bierzemy z tagu script, żeby klient nie musiał go konfigurować.
  // Bez data-api zaczepka po prostu się nie pojawi — czat działa normalnie.
  var apiUrl = scriptTag.getAttribute('data-api') || '';

  // Wersja językowa strony klienta. Zaczepka pokazuje się, zanim odwiedzający
  // cokolwiek napisze, więc nie ma z czego wykryć języka z rozmowy — bierzemy
  // to, co strona sama o sobie deklaruje.
  var langStrony = document.documentElement.getAttribute('lang')
    || (navigator.language || '');

  // Raz pokazana i zamknięta zaczepka nie wraca w tej sesji. Dymek wyskakujący
  // na każdej podstronie jest natrętny i to on, a nie czat, zostaje zapamiętany.
  var KLUCZ_SESJI = 'sm-art-zaczepka-zamknieta';
  function zaczepkaOdrzucona() {
    try {
      return sessionStorage.getItem(KLUCZ_SESJI) === '1';
    } catch (e) {
      // Tryb prywatny potrafi rzucać przy samym dostępie do sessionStorage
      return false;
    }
  }
  function zapamietajOdrzucenie() {
    try {
      sessionStorage.setItem(KLUCZ_SESJI, '1');
    } catch (e) { /* brak pamięci sesji nie może wywrócić widgetu */ }
  }

  // Paleta z agencjasm-art.pl. Kolor klienta w białej etykiecie dociąga
  // zaplanujZaczepke() — do tego czasu stoi espresso, nie przypadkowy granat.
  var ESPRESSO = '#110c04';
  var EMBER = '#F97316';
  var KREM = '#FAF8F5';
  var KANT = '2px';

  var button = document.createElement('button');
  button.setAttribute('type', 'button');
  // aria-expanded mówi czytnikowi ekranu, czy okno jest otwarte. Bez tego
  // użytkownik słyszy tylko "Otwórz czat" i nie wie, czy kliknięcie zadziałało.
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Otwórz czat');
  button.style.cssText = [
    'position:fixed',
    'bottom:20px',
    position + ':20px',
    'width:56px',
    'height:56px',
    // Kant zamiast koła i kreska u dołu zamiast cienia — ten sam język,
    // co reszta okna czatu. Emoji zastąpione rysunkiem, bo 💬 wygląda
    // inaczej na każdym systemie i psuje wrażenie gotowego produktu.
    'border-radius:' + KANT,
    'background:' + ESPRESSO,
    'border:none',
    'border-bottom:2px solid ' + EMBER,
    'box-shadow:0 6px 20px rgba(17,12,4,0.28)',
    'cursor:pointer',
    'z-index:2147483000',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:0',
  ].join(';');
  button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"'
    + ' aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z" stroke="' + KREM
    + '" stroke-width="1.8" stroke-linejoin="round"/></svg>';

  /**
   * Ramkę tworzymy dopiero, gdy jest potrzebna.
   *
   * Wcześniej powstawała od razu przy wczytaniu strony — ukryta, ale w pełni
   * pobrana. Odwiedzający, który nigdy nie otworzył czatu, i tak ściągał
   * dokument widgetu, wszystkie jego pliki JS i CSS oraz dwa zapytania do API.
   * Widget obciążał więc Core Web Vitals każdej podstrony klienta, także tam,
   * gdzie nikt z niego nie korzystał.
   *
   * Pozycja fixed sprawia, że sam przycisk nie przesuwa układu strony.
   */
  function utworzRamke() {
    if (iframe) return iframe;

    iframe = document.createElement('iframe');
    // Ramka bez tytułu jest dla czytnika ekranu bezimienna — WCAG 4.1.2
    iframe.setAttribute('title', 'Okno czatu');
    iframe.src = origin + '/widget?key=' + encodeURIComponent(apiKey)
      + (langStrony ? '&lang=' + encodeURIComponent(langStrony) : '');
    iframe.style.cssText = [
      'position:fixed',
      'bottom:88px',
      position + ':20px',
      'width:360px',
      'height:520px',
      'max-width:calc(100vw - 40px)',
      'max-height:calc(100vh - 120px)',
      'border:none',
      'border-radius:' + KANT,
      'box-shadow:0 12px 40px rgba(17,12,4,0.26)',
      'z-index:2147483000',
      'display:none',
    ].join(';');
    document.body.appendChild(iframe);
    return iframe;
  }

  /**
   * Wstępne wczytanie po pierwszym sygnale, że ktoś faktycznie korzysta ze
   * strony. Dzięki temu otwarcie czatu jest natychmiastowe, a użytkownik,
   * który wchodzi i wychodzi, nie płaci za nic. requestIdleCallback czeka
   * na moment bezczynności przeglądarki, żeby nie konkurować z renderowaniem
   * treści klienta.
   */
  var rozgrzano = false;
  function rozgrzej() {
    if (rozgrzano) return;
    rozgrzano = true;
    odepnijSygnaly();

    var start = function () { utworzRamke(); };
    if (window.requestIdleCallback) {
      window.requestIdleCallback(start, { timeout: 3000 });
    } else {
      setTimeout(start, 1200);
    }
  }

  var SYGNALY = ['pointermove', 'touchstart', 'scroll', 'keydown'];
  function odepnijSygnaly() {
    SYGNALY.forEach(function (nazwa) {
      window.removeEventListener(nazwa, rozgrzej);
    });
  }

  /**
   * Zaczepka: gotowy tekst pokazywany przy przycisku po zadanym czasie.
   *
   * Celowo nie woła modelu — nie zużywa limitu planu ani pieniędzy za API,
   * dlatego może działać u wszystkich klientów. Płatną wiadomością jest dopiero
   * odpowiedź na nią, już w normalnym czacie.
   */
  function pokazZaczepke(tekst) {
    if (dymek || isOpen || zaczepkaOdrzucona()) return;

    dymek = document.createElement('div');
    // role="status" ogłasza treść czytnikowi ekranu, ale nie przerywa tego,
    // co użytkownik właśnie robi — dymek jest zaczepką, nie alertem
    dymek.setAttribute('role', 'status');
    dymek.style.cssText = [
      'position:fixed',
      'bottom:88px',
      position + ':20px',
      'max-width:260px',
      'padding:12px 34px 12px 14px',
      'background:#ffffff',
      'color:#241a0e',
      'font:13px/1.55 system-ui,-apple-system,Segoe UI,sans-serif',
      'border:1px solid rgba(36,26,14,0.12)',
      'border-left:2px solid ' + EMBER,
      'border-radius:' + KANT,
      'box-shadow:0 8px 30px rgba(17,12,4,0.16)',
      'z-index:2147483000',
      'cursor:pointer',
    ].join(';');
    dymek.textContent = tekst;

    var zamknij = document.createElement('button');
    zamknij.setAttribute('type', 'button');
    zamknij.setAttribute('aria-label', 'Zamknij wiadomość');
    zamknij.textContent = '×';
    zamknij.style.cssText = [
      'position:absolute',
      'top:4px',
      'right:6px',
      'border:none',
      'background:none',
      'color:#6b5a48',
      'font-size:18px',
      'line-height:1',
      'cursor:pointer',
      'padding:4px',
    ].join(';');
    zamknij.addEventListener('click', function (zdarzenie) {
      // Bez tego kliknięcie w krzyżyk otwiera czat, bo trafia też w dymek
      zdarzenie.stopPropagation();
      ukryjZaczepke(true);
    });

    dymek.addEventListener('click', function () {
      ukryjZaczepke(true);
      ustawStan(true);
    });

    dymek.appendChild(zamknij);
    document.body.appendChild(dymek);
  }

  function ukryjZaczepke(zapamietaj) {
    if (zapamietaj) zapamietajOdrzucenie();
    if (dymek && dymek.parentNode) dymek.parentNode.removeChild(dymek);
    dymek = null;
  }

  /**
   * Ustawienia pobieramy same z siebie, bo zaczepka musi pojawić się zanim
   * powstanie ramka czatu — inaczej trzeba by ładować cały widget na każdej
   * podstronie i lazy loading traci sens. To jedno małe zapytanie GET.
   */
  /**
   * Czerń albo biel — to, co lepiej czyta się na kolorze klienta.
   * Ten sam rachunek co w theme.ts; tu bez importu, bo embed.js jest
   * czystym plikiem czytanym wprost przez przeglądarkę.
   */
  function naWypelnieniu(kolor) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(kolor).trim());
    if (!m) return KREM;
    var n = parseInt(m[1], 16);
    var k = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (w) {
      var u = w / 255;
      return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
    });
    var l = 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
    // Próg 0.179 to punkt, w którym biel i czerń dają ten sam kontrast
    return l > 0.179 ? '#1a1108' : KREM;
  }

  function zastosujMarke(dane) {
    if (!dane || dane.branding_mode !== 'white_label') return;
    var kolor = dane.widget_color;
    if (!/^#?[0-9a-f]{6}$/i.test(String(kolor || '').trim())) return;

    // Klient płaci za to, żeby widget nie wyglądał na nasz — z pomarańczową
    // krawędzią i tak by wyglądał
    button.style.background = kolor;
    button.style.borderBottom = 'none';
    var rysunek = button.querySelector('path');
    if (rysunek) rysunek.setAttribute('stroke', naWypelnieniu(kolor));
  }

  function zaplanujZaczepke() {
    if (!apiUrl) return;

    var adres = apiUrl.replace(/\/$/, '') + '/widget-settings/'
      + (langStrony ? '?lang=' + encodeURIComponent(langStrony) : '');

    fetch(adres, { headers: { 'X-API-Key': apiKey } })
      .then(function (odpowiedz) {
        return odpowiedz.ok ? odpowiedz.json() : null;
      })
      .then(function (dane) {
        zastosujMarke(dane);
        if (zaczepkaOdrzucona()) return;
        if (!dane || !dane.widget_proactive_enabled) return;
        var tekst = dane.widget_proactive_text;
        if (!tekst) return;

        var opoznienie = Number(dane.widget_proactive_delay_seconds);
        if (!isFinite(opoznienie) || opoznienie < 0) opoznienie = 30;

        setTimeout(function () {
          pokazZaczepke(tekst);
        }, opoznienie * 1000);
      })
      .catch(function () {
        // Niedostępne API nie może psuć strony klienta — czat i tak zadziała
      });
  }

  function ustawStan(otwarte) {
    // Otwarcie czatu czyni zaczepkę bezprzedmiotową
    if (otwarte) ukryjZaczepke(false);
    isOpen = otwarte;
    // Klik może wyprzedzić rozgrzewkę — wtedy tworzymy ramkę natychmiast
    var ramka = utworzRamke();
    ramka.style.display = otwarte ? 'block' : 'none';
    button.setAttribute('aria-expanded', otwarte ? 'true' : 'false');
    button.setAttribute('aria-label', otwarte ? 'Zamknij czat' : 'Otwórz czat');
  }

  button.addEventListener('click', function () {
    ustawStan(!isOpen);
  });

  // Najazd i ognisko na przycisku to najsilniejsza zapowiedź otwarcia
  button.addEventListener('mouseenter', rozgrzej);
  button.addEventListener('focus', rozgrzej);

  // Escape zamyka okno i oddaje ognisko przyciskowi — bez tego użytkownik
  // klawiatury zostaje uwięziony w ramce bez wyjścia.
  document.addEventListener('keydown', function (zdarzenie) {
    if (zdarzenie.key === 'Escape' && isOpen) {
      ustawStan(false);
      button.focus();
    }
  });

  function mount() {
    document.body.appendChild(button);
    SYGNALY.forEach(function (nazwa) {
      window.addEventListener(nazwa, rozgrzej, { passive: true, once: false });
    });
    zaplanujZaczepke();
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }
})();
