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
    'border-radius:50%',
    'background:#111827',
    'color:#fff',
    'border:none',
    'box-shadow:0 4px 12px rgba(0,0,0,0.25)',
    'cursor:pointer',
    'z-index:2147483000',
    'font-size:24px',
  ].join(';');
  button.textContent = '💬';

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
      'border-radius:12px',
      'box-shadow:0 8px 30px rgba(0,0,0,0.25)',
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
      'background:#fff',
      'color:#111827',
      'font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif',
      'border-radius:12px',
      'box-shadow:0 8px 30px rgba(0,0,0,0.18)',
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
      'color:#6b7280',
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
  function zaplanujZaczepke() {
    if (!apiUrl || zaczepkaOdrzucona()) return;

    var adres = apiUrl.replace(/\/$/, '') + '/widget-settings/'
      + (langStrony ? '?lang=' + encodeURIComponent(langStrony) : '');

    fetch(adres, { headers: { 'X-API-Key': apiKey } })
      .then(function (odpowiedz) {
        return odpowiedz.ok ? odpowiedz.json() : null;
      })
      .then(function (dane) {
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
