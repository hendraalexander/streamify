import app from "./app.js";

const PORT = process.env.PORT || 4177;

app.listen(PORT, () => {
  console.log(`Streamify API running on http://127.0.0.1:${PORT}`);
});
