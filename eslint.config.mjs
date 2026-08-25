// eslint-config-next 16 dostarcza konfigurację flat natywnie — warstwa
// zgodności FlatCompat, wymagana przy Next 15, wywracała się tutaj na
// cyklicznej strukturze podczas walidacji.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    rules: {
      // Interfejs jest po polsku, a polski cudzysłów to „…". Reguła widzi
      // znak zamykający (U+201D) jako niezescapowany apostrof HTML i każe
      // pisać &rdquo; w środku zdania — źródło staje się wtedy nieczytelne,
      // a wynik w przeglądarce identyczny. To nie jest błąd, tylko reguła
      // napisana pod angielski.
      "react/no-unescaped-entities": "off",
    },
  },
];

export default eslintConfig;
