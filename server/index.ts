import app from "./app";

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`API siap di http://localhost:${port}`));
