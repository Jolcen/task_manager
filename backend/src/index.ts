import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.JWT_SECRET || "mi_clave_secreta";

const app = express();
const PORT = process.env.PORT || 3000;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida en el archivo .env");
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Uso de CORS: permite que el frontend en Vite se conecte al backend
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://taskmanagerpalacios.vercel.app",
      "https://taskmanagerpalacios-3e4y8ti2y-jolcens-projects.vercel.app"
    ],
  })
);

app.use(express.json());

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Token no proporcionado",
    });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      message: "Formato de token inválido",
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      message: "Token inválido o expirado",
    });
  }
};

app.get("/", (req: Request, res: Response) => {
  res.send("backend is working");
});

app.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: "Username y password son obligatorios",
    });
  }

  if (username === "admin" && password === "123456") {
    const token = jwt.sign(
      { username: username },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    return res.json({
      message: "Login correcto",
      token,
    });
  }

  return res.status(401).json({
    message: "Credenciales inválidas",
  });
});

// GET: devuelve todas las tareas desde PostgreSQL
app.get("/tasks", async (req: Request, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: {
        id: "asc",
      },
    });

    res.json(tasks);
  } catch (error) {
    console.error("Error al obtener tareas:", error);
    res.status(500).json({ message: "Error al obtener tareas" });
  }
});

// POST: crea una nueva tarea en PostgreSQL
app.post("/tasks", async (req: Request, res: Response) => {
  try {
    const { title, completed } = req.body;

    if (!title || title.trim() === "") {
      return res.status(400).json({
        message: "El título de la tarea es obligatorio",
      });
    }

    const newTask = await prisma.task.create({
      data: {
        title: title.trim(),
        completed: completed ?? false,
      },
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error("Error al crear tarea:", error);
    res.status(500).json({ message: "Error al crear tarea" });
  }
});

// DELETE: elimina una tarea por id en PostgreSQL
app.delete("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return res.status(404).json({
        message: "Tarea no encontrada",
      });
    }

    await prisma.task.delete({
      where: { id },
    });

    res.json({
      message: "Tarea eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar tarea:", error);
    res.status(500).json({ message: "Error al eliminar tarea" });
  }
});

// PUT: actualiza el estado completed de una tarea en PostgreSQL
app.put("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { completed } = req.body;

    if (typeof completed !== "boolean") {
      return res.status(400).json({
        message: "El campo completed debe ser boolean",
      });
    }

    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return res.status(404).json({
        message: "Tarea no encontrada",
      });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { completed },
    });

    res.json(updatedTask);
  } catch (error) {
    console.error("Error al actualizar tarea:", error);
    res.status(500).json({ message: "Error al actualizar tarea" });
  }
});

app.get("/private", verifyToken, (req: Request, res: Response) => {
  res.json({
    message: "Acceso permitido",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});