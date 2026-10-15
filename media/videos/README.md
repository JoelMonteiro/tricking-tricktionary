# Vídeos dos tricks

Coloca aqui um vídeo por trick, com o **id** do trick como nome do ficheiro:

```
media/videos/540.mp4
media/videos/butterfly-twist.mp4
media/videos/cheat-720-twist-hyper.mp4
```

O id de cada trick está em `data/tricks.json` (campo `"id"`). Depois, no mesmo trick, aponta o campo `"video"` para o ficheiro:

```json
{
  "id": "540",
  "name": "540",
  "video": "media/videos/540.mp4",
  ...
}
```

Dicas:
- **MP4 (H.264), sem som, curto (2–5 s) e em loop.** É o formato que todos os browsers reproduzem. O vídeo já é mostrado sem som e em loop.
- Para ficar leve, reduz para 640 px de largura:
  `ffmpeg -i original.mov -vf scale=640:-2 -an -c:v libx264 -crf 28 -movflags +faststart 540.mp4`
- Se o ficheiro indicado não existir, a página mostra automaticamente o `placeholder.mp4`.
- Usa só vídeos teus ou com autorização de quem aparece neles.
