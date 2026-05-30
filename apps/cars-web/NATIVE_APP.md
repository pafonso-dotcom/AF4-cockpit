# Aurum Finanças · App Nativo (iOS / Android / macOS)

O cockpit já é **PWA** — basta abrir no Safari/Chrome do celular e usar "Adicionar à tela inicial" pra ele funcionar como app, com ícone, sem barra de URL, e acesso offline.

Para um **app nativo verdadeiro** (na App Store, com badge de notificação, Touch ID etc), você pode empacotar com **Capacitor**:

## 🍎 iOS / macOS (precisa de Mac)

```bash
# 1. Instalar Capacitor
npm install -D @capacitor/core @capacitor/cli
npm install @capacitor/ios

# 2. Build do app web
npm run build

# 3. Adicionar plataforma iOS
npx cap add ios

# 4. Sincronizar arquivos web → projeto nativo
npx cap sync

# 5. Abrir no Xcode pra rodar/publicar
npx cap open ios
```

No Xcode:
- Selecione **My Mac** ou **iPhone Simulator** e dê **▶ Run**
- Para publicar: **Product → Archive → Distribute App**

## 🤖 Android

```bash
npm install @capacitor/android
npx cap add android
npx cap sync
npx cap open android
```

Precisa do **Android Studio** instalado. Build do APK em **Build → Generate Signed Bundle / APK**.

## 🔁 Atualizar depois de mudanças no código web

Sempre que alterar o app:

```bash
npm run build
npx cap sync     # leva o build atualizado pros projetos nativos
```

## Recursos que o app nativo libera

| Recurso | Web (PWA) | App nativo |
|---|---|---|
| Acesso offline | ✓ | ✓ |
| Notificações push | ✓ (limitado iOS) | ✓ (completo) |
| Badge no ícone com contagem | ✗ | ✓ |
| Touch ID / Face ID | ✗ | ✓ |
| Acesso à câmera p/ OCR | ✓ | ✓ (melhor) |
| Compartilhamento nativo | ✗ | ✓ |
| Loja de apps | ✗ | ✓ |

## Configuração

Veja `capacitor.config.js` na raiz — já configurado com:
- App ID: `com.af4motors.cockpit`
- Cor de fundo: `#0a0908` (combina com a paleta dourada)
- Splash screen estilizada
- Status bar escura

## Notas

- O Capacitor envolve o app web em uma WebView nativa. Nada do seu código React precisa mudar.
- Para Apple Store: você precisa de conta de desenvolvedor (US$ 99/ano).
- Para Google Play: conta de desenvolvedor (US$ 25 uma vez).
- Em ambos os casos, o app gerado é um arquivo único que carrega o conteúdo já buildado — funciona 100% offline depois do primeiro carregamento.
