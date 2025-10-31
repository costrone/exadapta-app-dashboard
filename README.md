# ExAdapta — CAT React + Firebase (Dashboard)

Proyecto listo para tu Firebase `exadapta` con:
- Auth Google
- Roles automáticos por dominio (`@colegiovicentepaul.es` → `teacher`)
- Banco de preguntas en Firestore
- Test adaptativo 1–5
- Panel docente: selector de banco, tabla de intentos, **export CSV**, **histograma**

## Puesta en marcha
```bash
npm install
npm run dev
# http://localhost:5173
```

## Despliegue
```bash
firebase deploy --only firestore:rules
npm run build
firebase deploy --only hosting
```

## Flujo de prueba
1) Inicia sesión con tu cuenta del dominio (rol `teacher`).  
2) En pestaña **Panel docente** → “Sembrar banco demo y empezar” o elige un banco y **Comenzar test**.  
3) Completa el test y pulsa **Guardar intento** (en la vista del test al finalizar).  
4) Exporta CSV desde el panel y revisa la distribución de niveles.

Trigger CI: prueba de despliegue automática

