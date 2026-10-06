CONTROL DE ALQUILERES E INVERSIONES INMOBILIARIAS — versión 1.0
================================================================

Aplicación web (HTML5 + CSS + JavaScript + IndexedDB), sin dependencias, sin cuentas y sin servidores.
Todos los datos se guardan SOLO en el navegador del dispositivo en el que se usa.

ESTRUCTURA
----------
  index.html            Página principal
  styles.css            Estilos (responsive: menú lateral en escritorio, barra inferior en móvil)
  manifest.json         Configuración de instalación (PWA) — nombre «Control de Alquileres»
  service-worker.js     Funcionamiento sin conexión (PWA)
  icons/                Iconos 192, 512 y 512 «maskable»
  js/util.js            Fechas, importes y formato
  js/db.js              Almacenamiento: IndexedDB (y localStorage como alternativa)
  js/calc.js            Motor de cálculo (rentabilidad, flujo de caja, hipotecas, alertas, calendario, buscador)
  js/ui.js              Componentes (formularios, tablas, gráficos, fórmulas)
  js/forms.js           Altas, ediciones, eliminaciones, copias de seguridad
  js/views.js           Pantallas generales
  js/ficha.js           Ficha de cada vivienda (16 pestañas)
  js/demo.js            Datos de EJEMPLO (ficticios, eliminables)
  js/app.js             Arranque y navegación
  servidor-local.ps1    Servidor local mínimo (solo localhost) para instalar la app en Windows
  Abrir Control de Alquileres.bat   Lanza el servidor local y abre el navegador

USO EN WINDOWS
--------------
Opción A (más sencilla): doble clic en index.html. Funciona en Chrome, Edge y Firefox, también sin Internet.
  Limitación: abierta como archivo (file://) el navegador no permite instalarla como aplicación.

Opción B (recomendada, instalable): doble clic en «Abrir Control de Alquileres.bat».
  Se abre http://localhost:8765. En Edge o Chrome pulse el icono «Instalar» de la barra de direcciones
  (o menú → Aplicaciones → Instalar). A partir de entonces se abre como programa independiente y funciona
  sin conexión. El servidor solo escucha en este ordenador; no publica nada en Internet.

IMPORTANTE: el navegador guarda los datos por «origen». Los datos de la opción A (file://) y de la
opción B (localhost:8765) son independientes. Use siempre la misma forma de abrirla o traspase los datos
con «Exportar / Importar copia de seguridad».

USO EN ANDROID (y tablet)
-------------------------
Chrome para Android solo permite instalar una PWA servida por https. Dos posibilidades:
  1) Publicar ESTA carpeta en un alojamiento estático gratuito con https (por ejemplo GitHub Pages o
     Netlify Drop, arrastrando la carpeta). Solo se publica el código: los datos siguen guardándose en el
     teléfono y nunca se envían al servidor. Abra la dirección en Chrome → menú ⋮ → «Instalar aplicación».
  2) Usarla en Windows y llevar los datos al móvil mediante la copia de seguridad.

COPIAS DE SEGURIDAD (REQUISITO CRÍTICO)
---------------------------------------
Configuración → «EXPORTAR COPIA DE SEGURIDAD» genera un archivo .json con todo: viviendas, contratos,
inquilinos, cobros, gastos, agua, hipotecas, amortizaciones, documentos, históricos y configuración.
En Android aparece también «Compartir copia» (Drive, correo, WhatsApp…).
«IMPORTAR COPIA DE SEGURIDAD» admite el mismo archivo en cualquier dispositivo (Android ⇄ Windows),
en modo «Reemplazar» o «Fusionar». La aplicación avisa si pasan más de 30 días sin exportar copia.
Si borra los datos de navegación del navegador, se borran también los datos de la aplicación: exporte
copias con regularidad.

CRITERIOS DE CÁLCULO (se muestran también en pantalla)
------------------------------------------------------
- Coste total de adquisición = precio + impuestos (ITP/IVA/otros) + notaría + registro + gestoría +
  agencia + reformas + mobiliario + electrodomésticos + otros gastos.
- Rentabilidad bruta = alquiler anual (renta actual × 12) / coste total × 100.
- Rentabilidad neta = (ingresos − gastos − intereses hipotecarios) / coste total × 100.
- Rentabilidad sobre capital aportado = beneficio / capital aportado × 100
  (capital aportado = coste total − préstamo inicial, o el importe que usted indique).
- Flujo de caja = ingresos cobrados − gastos pagados − cuotas hipotecarias pagadas.
- La amortización de capital NO es gasto; los intereses SÍ son coste financiero.
- Criterio de caja: se computan importes efectivamente cobrados y pagados.
- Contrato VENCIDO cuando la fecha actual es posterior a la de vencimiento: se resalta en amarillo con
  el texto «VENCIDO» hasta registrar renovación, prórroga, nuevo contrato o cambiar la fecha.
- Simulador y fecha de cancelación: sistema francés con el capital pendiente, la cuota y el tipo vigentes.
  «Estimación basada en los datos introducidos.»
Si falta un dato necesario se muestra «Datos insuficientes para realizar este cálculo.»

DATOS DE EJEMPLO
----------------
Son ficticios, llevan «[EJEMPLO]» en el nombre y se eliminan en Configuración → «Eliminar datos de ejemplo»
(se borran también los registros que haya añadido a esas viviendas de ejemplo).
