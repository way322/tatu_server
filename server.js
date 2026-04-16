require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database');
const { generateToken, verifyToken } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ------------------ Публичные маршруты ------------------

// Поиск активной записи по телефону (для страницы "Моя запись")
app.get('/api/appointments/by-phone', (req, res) => {
  const { phone } = req.query;
  if (!phone || phone.length !== 11) {
    return res.status(400).json({ error: 'Некорректный номер' });
  }
  const cleanedPhone = phone.replace(/\D/g, '');
  db.get(
    `SELECT * FROM appointments WHERE phone = ? AND status = 'pending' ORDER BY createdAt DESC LIMIT 1`,
    [cleanedPhone],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || null);
    }
  );
});

// Создание новой записи (без авторизации)
app.post('/api/appointments', (req, res) => {
  const {
    clientName, date, master, service, phone,
    tattooIdea, tattooSize, bodyPlacement
  } = req.body;

  // Валидация
  if (!clientName || !date || !master || !service || !phone || phone.length !== 11) {
    return res.status(400).json({ error: 'Не все обязательные поля заполнены' });
  }

  // Проверка, нет ли уже активной записи на этот телефон
  db.get(
    `SELECT id FROM appointments WHERE phone = ? AND status = 'pending'`,
    [phone],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) {
        return res.status(409).json({ error: 'Этот номер уже имеет активную запись' });
      }

      // Проверка занятости мастера
      db.get(
        `SELECT id FROM appointments WHERE master = ? AND date = ? AND status = 'pending'`,
        [master, date],
        (err2, busy) => {
          if (err2) return res.status(500).json({ error: err2.message });
          if (busy) {
            return res.status(409).json({ error: 'Мастер уже занят в это время' });
          }

          const createdAt = new Date().toISOString();
          db.run(
            `INSERT INTO appointments (
              clientName, date, master, service, phone,
              tattooIdea, tattooSize, bodyPlacement, status, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
            [clientName, date, master, service, phone,
             tattooIdea || '', tattooSize || '', bodyPlacement || '', createdAt],
            function(err3) {
              if (err3) return res.status(500).json({ error: err3.message });
              res.status(201).json({ id: this.lastID, ...req.body, status: 'pending', createdAt });
            }
          );
        }
      );
    }
  );
});

// ------------------ Админские маршруты (требуют токен) ------------------

app.post('/api/admin/login', (req, res) => {
  const { login, password } = req.body;
  if (login === process.env.ADMIN_LOGIN && password === process.env.ADMIN_PASSWORD) {
    const token = generateToken();
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Неверные учетные данные' });
  }
});

// Все записи (сортировка по дате создания)
app.get('/api/admin/appointments', verifyToken, (req, res) => {
  db.all(`SELECT * FROM appointments ORDER BY createdAt DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Обновить статус записи
app.put('/api/admin/appointments/:id/status', verifyToken, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  let updateField = '';
  if (status === 'completed') updateField = 'completedAt = ?';
  if (status === 'cancelled') updateField = 'canceledAt = ?';

  const timestamp = new Date().toISOString();
  const sql = updateField
    ? `UPDATE appointments SET status = ?, ${updateField} WHERE id = ?`
    : `UPDATE appointments SET status = ? WHERE id = ?`;

  const params = updateField ? [status, timestamp, id] : [status, id];

  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: true });
  });
});

// Удалить одну запись
app.delete('/api/admin/appointments/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM appointments WHERE id = ?`, id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: true });
  });
});

// Очистить архив (completed + cancelled)
app.delete('/api/admin/appointments/archive', verifyToken, (req, res) => {
  db.run(`DELETE FROM appointments WHERE status IN ('completed', 'cancelled')`, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});