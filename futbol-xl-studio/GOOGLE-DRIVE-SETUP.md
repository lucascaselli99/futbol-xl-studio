# Google Drive en Fútbol XL Studio

Esta versión agrega Google Picker dentro de cada proyecto.

## 1. Google Cloud

En el mismo proyecto de Google Cloud:

1. Habilitá **Google Picker API**.
2. Habilitá **Google Drive API**.
3. Creá un **OAuth Client ID** de tipo **Web application**.
4. En **Authorized JavaScript origins** agregá el dominio de Fútbol XL Studio, por ejemplo:
   - `https://futbolxl.vercel.app`
5. Creá una **API Key** y restringila:
   - Website restrictions: tu dominio de Fútbol XL Studio y `https://docs.google.com/*`.
   - API restrictions: Google Picker API + Google Drive API.
6. Buscá el **Project number** del proyecto. Ese número es el `GOOGLE_DRIVE_APP_ID`.

No hace falta usar un Client Secret en el navegador.

## 2. Variables en Vercel

En Project Settings → Environment Variables agregá:

- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_API_KEY`
- `GOOGLE_DRIVE_APP_ID`

Después hacé un nuevo deploy.

## 3. Uso

1. Entrá a **Configuración → Google Drive**.
2. Tocá **Conectar Google Drive**.
3. Abrí cualquier proyecto → **Enlaces de Drive**.
4. Junto a cada enlace principal aparece **Drive** para elegir un archivo o carpeta.
5. En **Enlaces adicionales** podés elegir varios recursos de una sola vez.

La integración solicita el scope `drive.file`: Fútbol XL Studio solo recibe acceso a los archivos que elegís explícitamente mediante Google Picker.
