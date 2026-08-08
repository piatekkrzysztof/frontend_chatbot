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
];

export default eslintConfig;
