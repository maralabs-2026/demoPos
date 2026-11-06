# Lector de códigos de barras (zxing-wasm)

`zxing_reader.wasm` es una copia de `node_modules/zxing-wasm/dist/reader/zxing_reader.wasm` (licencia MIT, https://github.com/Sec-ant/zxing-wasm). Lo carga `barcode-detector` cuando el navegador no tiene un lector propio (por ejemplo, en iPhone). Se sirve desde el sitio para no depender de un CDN.

Al actualizar `barcode-detector` o `zxing-wasm`, volvé a copiar el archivo. El test `src/lib/codigos.test.ts` falla si la copia no coincide con la instalada.
