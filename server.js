const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'masjid-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

let db;

async function initDB() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'masjid.db');
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'guest',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS prayer_times (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      adhan_time TEXT NOT NULL,
      iqamah_time TEXT NOT NULL,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sermons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      speaker TEXT NOT NULL,
      description TEXT,
      sermon_date DATE,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS maintenance_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      assigned_to INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      expense_date DATE,
      status TEXT DEFAULT 'pending',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      event_date DATE,
      location TEXT,
      signup_type TEXT DEFAULT 'none',
      max_volunteers INTEGER DEFAULT 0,
      max_attendees INTEGER DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS event_volunteers (
      event_id INTEGER,
      user_id INTEGER,
      role_type TEXT,
      signed_up_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (event_id, user_id),
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS event_attendees (
      event_id INTEGER,
      user_id INTEGER,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (event_id, user_id),
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.run(`DROP TABLE IF EXISTS event_signups`);
  db.run(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      agenda TEXT,
      meeting_date DATETIME,
      location TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS finances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      transaction_date DATE,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      page TEXT NOT NULL,
      can_view INTEGER DEFAULT 0,
      can_edit INTEGER DEFAULT 0,
      UNIQUE(role, page)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const adminExists = db.exec("SELECT id FROM users WHERE email = 'admin@masjid.com'");
  if (adminExists.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", ['Admin', 'admin@masjid.com', hash, 'admin']);
    db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", ['Imam Ahmed', 'imam@masjid.com', bcrypt.hashSync('imam123', 10), 'imam']);
    db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", ['Khadim Omar', 'khadim@masjid.com', bcrypt.hashSync('khadim123', 10), 'khadim']);
    db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", ['Committee Head', 'committee@masjid.com', bcrypt.hashSync('committee123', 10), 'committee']);

    db.run("INSERT INTO prayer_times (name, adhan_time, iqamah_time) VALUES (?, ?, ?)", ['Fajr', '05:30', '05:45']);
    db.run("INSERT INTO prayer_times (name, adhan_time, iqamah_time) VALUES (?, ?, ?)", ['Dhuhr', '12:30', '12:45']);
    db.run("INSERT INTO prayer_times (name, adhan_time, iqamah_time) VALUES (?, ?, ?)", ['Asr', '16:00', '16:15']);
    db.run("INSERT INTO prayer_times (name, adhan_time, iqamah_time) VALUES (?, ?, ?)", ['Maghrib', '18:45', '18:50']);
    db.run("INSERT INTO prayer_times (name, adhan_time, iqamah_time) VALUES (?, ?, ?)", ['Isha', '20:00', '20:15']);

    db.run("INSERT INTO announcements (title, body, author_id) VALUES (?, ?, ?)", ['Welcome to Our Mosque App', 'Assalamu Alaikum! Welcome to our mosque community management system.', 1]);
    db.run("INSERT INTO announcements (title, body, author_id) VALUES (?, ?, ?)", ['Ramadan Mubarak', 'May this blessed month bring peace and blessings to all.', 1]);
    
    const defaultPermissions = [
      ['admin', 'prayer_times', 1, 1],
      ['admin', 'events', 1, 1],
      ['admin', 'announcements', 1, 1],
      ['admin', 'sermons', 1, 1],
      ['admin', 'meetings', 1, 1],
      ['admin', 'finances', 1, 1],
      ['admin', 'expenses', 1, 1],
      ['admin', 'maintenance', 1, 1],
      ['admin', 'users', 1, 1],
      ['admin', 'settings', 1, 1],
      ['imam', 'prayer_times', 1, 1],
      ['imam', 'events', 1, 0],
      ['imam', 'announcements', 1, 1],
      ['imam', 'sermons', 1, 1],
      ['imam', 'meetings', 1, 0],
      ['imam', 'finances', 0, 0],
      ['imam', 'expenses', 0, 0],
      ['imam', 'maintenance', 0, 0],
      ['imam', 'users', 0, 0],
      ['imam', 'settings', 0, 0],
      ['khadim', 'prayer_times', 1, 0],
      ['khadim', 'events', 1, 0],
      ['khadim', 'announcements', 0, 0],
      ['khadim', 'sermons', 0, 0],
      ['khadim', 'meetings', 0, 0],
      ['khadim', 'finances', 0, 0],
      ['khadim', 'expenses', 0, 0],
      ['khadim', 'maintenance', 1, 1],
      ['khadim', 'users', 0, 0],
      ['khadim', 'settings', 0, 0],
      ['committee', 'prayer_times', 1, 0],
      ['committee', 'events', 1, 0],
      ['committee', 'announcements', 1, 0],
      ['committee', 'sermons', 0, 0],
      ['committee', 'meetings', 1, 1],
      ['committee', 'finances', 1, 1],
      ['committee', 'expenses', 0, 0],
      ['committee', 'maintenance', 0, 0],
      ['committee', 'users', 0, 0],
      ['committee', 'settings', 0, 0],
      ['volunteer', 'prayer_times', 1, 0],
      ['volunteer', 'events', 1, 0],
      ['volunteer', 'announcements', 1, 0],
      ['volunteer', 'sermons', 0, 0],
      ['volunteer', 'meetings', 0, 0],
      ['volunteer', 'finances', 0, 0],
      ['volunteer', 'expenses', 0, 0],
      ['volunteer', 'maintenance', 0, 0],
      ['volunteer', 'users', 0, 0],
      ['volunteer', 'settings', 0, 0],
      ['guest', 'prayer_times', 1, 0],
      ['guest', 'events', 1, 0],
      ['guest', 'announcements', 0, 0],
      ['guest', 'sermons', 0, 0],
      ['guest', 'meetings', 0, 0],
      ['guest', 'finances', 0, 0],
      ['guest', 'expenses', 0, 0],
      ['guest', 'maintenance', 0, 0],
      ['guest', 'users', 0, 0],
      ['guest', 'settings', 0, 0],
    ];
    defaultPermissions.forEach(p => {
      db.run("INSERT INTO role_permissions (role, page, can_view, can_edit) VALUES (?, ?, ?, ?)", p);
    });

    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('app_name', 'Masjid Community Center')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('app_logo', '/masjid-logo.svg')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('prayer_method', 'ISNA')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('timezone', 'America/New_York')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('contact_email', 'info@masjid.com')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('contact_phone', '+1 555-123-4567')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('address', '123 Mosque Street, City, State 12345')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', 'USD')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('donation_goal', '10000')");

    saveDB();
  }
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(path.join(__dirname, 'masjid.db'), buffer);
}

function getPermissionsForRole(role) {
  const result = db.exec(`SELECT page, can_view, can_edit FROM role_permissions WHERE role = '${role}'`);
  const permissions = {};
  if (result.length > 0) {
    result[0].values.forEach(row => {
      permissions[row[0]] = { can_view: row[1] === 1, can_edit: row[2] === 1 };
    });
  }
  return permissions;
}

function canAccessPage(role, page, type = 'view') {
  const result = db.exec(`SELECT ${type === 'edit' ? 'can_edit' : 'can_view'} FROM role_permissions WHERE role = '${role}' AND page = '${page}'`);
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values[0][0] === 1;
  }
  return false;
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function runQuery(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

function getSettings() {
  const settings = {};
  const results = queryAll('SELECT key, value FROM settings');
  results.forEach(row => {
    settings[row.key] = row.value;
  });
  return settings;
}

function updateSetting(key, value) {
  db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [key, value]);
  saveDB();
}

function isLoggedIn(req) {
  const loggedIn = req.session.userId !== undefined && req.session.userId !== null;
  console.log('isLoggedIn check:', { userId: req.session.userId, role: req.session.role, loggedIn });
  return loggedIn;
}

app.use((req, res, next) => {
  if (req.session.userId === 0 || req.session.userId > 0) {
    req.session.loggedIn = true;
  }
  res.locals.user = req.session.user;
  res.locals.role = req.session.role;
  res.locals.flash = req.session.flash;
  res.locals.permissions = req.session.role ? getPermissionsForRole(req.session.role) : {};
  res.locals.settings = getSettings();
  req.session.flash = null;
  next();
});

app.get('/', (req, res) => {
  if (isLoggedIn(req)) return res.redirect('/dashboard');
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (isLoggedIn(req)) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.userId = user.id;
    req.session.user = { id: user.id, name: user.name, email: user.email };
    req.session.role = user.role;
    return res.redirect('/dashboard');
  }
  res.render('login', { error: 'Invalid email or password' });
});

app.post('/login/guest', (req, res) => {
  req.session.userId = 0;
  req.session.user = { id: 0, name: 'Guest', email: 'guest@masjid.com' };
  req.session.role = 'guest';
  console.log('Guest login:', req.session);
  res.redirect('/dashboard');
});

app.get('/login/guest', (req, res) => {
  req.session.userId = 0;
  req.session.user = { id: 0, name: 'Guest', email: 'guest@masjid.com' };
  req.session.role = 'guest';
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.redirect('/guest-dashboard');
});

app.get('/guest-dashboard', (req, res) => {
  req.session.userId = 0;
  req.session.user = { id: 0, name: 'Guest', email: 'guest@masjid.com' };
  req.session.role = 'guest';
  
  const stats = {
    totalUsers: queryOne('SELECT COUNT(*) as count FROM users').count,
    announcements: queryOne('SELECT COUNT(*) as count FROM announcements').count,
    upcomingEvents: queryOne("SELECT COUNT(*) as count FROM events WHERE event_date >= date('now')").count,
    pendingTasks: queryOne("SELECT COUNT(*) as count FROM maintenance_tasks WHERE status = 'pending'").count,
    volunteers: queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'volunteer'").count,
    totalDonations: queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM finances WHERE type = 'donation'").total || 0,
    totalExpenses: (queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM finances WHERE type = 'expense'").total || 0) + (queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'paid'").total || 0)
  };
  
  const prayerTimes = queryAll('SELECT * FROM prayer_times ORDER BY id');
  const upcomingEvents = queryAll(`
    SELECT e.*, u.name as creator_name,
    (SELECT COUNT(*) FROM event_volunteers WHERE event_id = e.id) as volunteer_count,
    (SELECT COUNT(*) FROM event_attendees WHERE event_id = e.id) as attendee_count
    FROM events e LEFT JOIN users u ON e.created_by = u.id
    WHERE e.event_date >= date('now')
    ORDER BY e.event_date LIMIT 5
  `);
  const recentAnnouncements = queryAll('SELECT a.*, u.name as author_name FROM announcements a LEFT JOIN users u ON a.author_id = u.id ORDER BY a.created_at DESC LIMIT 5');
  const urgentTasks = queryAll("SELECT * FROM maintenance_tasks WHERE priority = 'urgent' AND status != 'completed' ORDER BY created_at DESC LIMIT 3");
  
  const prayerTimesList = queryAll('SELECT * FROM prayer_times ORDER BY id');
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  let nextPrayer = null;
  
  for (const prayer of prayerTimesList) {
    const [hours, mins] = prayer.iqamah_time.split(':').map(Number);
    const prayerMinutes = hours * 60 + mins;
    if (prayerMinutes > currentTime) {
      nextPrayer = prayer;
      break;
    }
  }
  
  if (!nextPrayer && prayerTimesList.length > 0) {
    nextPrayer = prayerTimesList[0];
  }
  
  res.render('dashboard', { 
    stats,
    recentAnnouncements,
    prayerTimes,
    upcomingEvents,
    myVolunteering: [],
    myAttendance: [],
    recentSermons: [],
    taskSummary: {},
    urgentTasks,
    upcomingMeetings: [],
    nextPrayer,
    error: null,
    currentPage: 'dashboard'
  });
});

app.get('/register', (req, res) => {
  if (isLoggedIn(req)) return res.redirect('/dashboard');
  res.render('register', { error: null });
});

app.post('/register', (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  if (password !== confirmPassword) {
    return res.render('register', { error: 'Passwords do not match' });
  }
  const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return res.render('register', { error: 'Email already registered' });
  }
  const hash = bcrypt.hashSync(password, 10);
  runQuery('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hash, 'guest']);
  res.redirect('/login');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/dashboard', (req, res) => {
  if (!isLoggedIn(req)) return res.redirect('/login');
  
  const stats = {
    totalUsers: queryOne('SELECT COUNT(*) as count FROM users').count,
    announcements: queryOne('SELECT COUNT(*) as count FROM announcements').count,
    upcomingEvents: queryOne("SELECT COUNT(*) as count FROM events WHERE event_date >= date('now')").count,
    pendingTasks: queryOne("SELECT COUNT(*) as count FROM maintenance_tasks WHERE status = 'pending'").count,
    volunteers: queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'volunteer'").count,
    totalDonations: queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM finances WHERE type = 'donation'").total || 0,
    totalExpenses: (queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM finances WHERE type = 'expense'").total || 0) + (queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'paid'").total || 0)
  };

  const recentAnnouncements = queryAll('SELECT a.*, u.name as author_name FROM announcements a LEFT JOIN users u ON a.author_id = u.id ORDER BY a.created_at DESC LIMIT 5');
  const prayerTimes = queryAll('SELECT * FROM prayer_times ORDER BY id');
  const upcomingEvents = queryAll(`
    SELECT e.*, u.name as creator_name,
    (SELECT COUNT(*) FROM event_volunteers WHERE event_id = e.id) as volunteer_count,
    (SELECT COUNT(*) FROM event_attendees WHERE event_id = e.id) as attendee_count
    FROM events e LEFT JOIN users u ON e.created_by = u.id
    WHERE e.event_date >= date('now')
    ORDER BY e.event_date LIMIT 5
  `);
  const myVolunteering = req.session.userId ? queryAll(`
    SELECT e.* FROM events e
    JOIN event_volunteers ev ON e.id = ev.event_id
    WHERE ev.user_id = ? ORDER BY e.event_date
  `, [req.session.userId]) : [];
  const myAttendance = req.session.userId ? queryAll(`
    SELECT e.* FROM events e
    JOIN event_attendees ea ON e.id = ea.event_id
    WHERE ea.user_id = ? ORDER BY e.event_date
  `, [req.session.userId]) : [];
  const recentSermons = queryAll('SELECT * FROM sermons ORDER BY sermon_date DESC LIMIT 5');
  const taskSummary = {
    pending: queryOne("SELECT COUNT(*) as count FROM maintenance_tasks WHERE status = 'pending'").count,
    in_progress: queryOne("SELECT COUNT(*) as count FROM maintenance_tasks WHERE status = 'in_progress'").count,
    completed: queryOne("SELECT COUNT(*) as count FROM maintenance_tasks WHERE status = 'completed'").count
  };
  const urgentTasks = queryAll("SELECT * FROM maintenance_tasks WHERE priority = 'urgent' AND status != 'completed' ORDER BY created_at DESC LIMIT 3");
  const upcomingMeetings = queryAll("SELECT * FROM meetings WHERE meeting_date >= datetime('now') ORDER BY meeting_date LIMIT 3");
  
  const prayerTimesList = queryAll('SELECT * FROM prayer_times ORDER BY id');
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  let nextPrayer = null;
  let nextPrayerTime = null;
  
  for (const prayer of prayerTimesList) {
    const [hours, mins] = prayer.iqamah_time.split(':').map(Number);
    const prayerMinutes = hours * 60 + mins;
    if (prayerMinutes > currentTime) {
      nextPrayer = prayer;
      nextPrayerTime = prayer.iqamah_time;
      break;
    }
  }
  
  if (!nextPrayer && prayerTimesList.length > 0) {
    nextPrayer = prayerTimesList[0];
    nextPrayerTime = prayerTimesList[0].iqamah_time;
    const [hours, mins] = nextPrayerTime.split(':').map(Number);
    const minutesUntil = (24 * 60 - currentTime) + (hours * 60 + mins);
    nextPrayer = { ...nextPrayer, minutesUntil };
  } else if (nextPrayer) {
    const [hours, mins] = nextPrayerTime.split(':').map(Number);
    nextPrayer = { ...nextPrayer, minutesUntil: (hours * 60 + mins) - currentTime };
  }

  res.render('dashboard', { stats, recentAnnouncements, prayerTimes, upcomingEvents, myVolunteering, myAttendance, recentSermons, taskSummary, urgentTasks, upcomingMeetings, nextPrayer, error: req.query.error, currentPage: 'dashboard' });
});

app.get('/admin/users', (req, res) => {
  if (!isLoggedIn(req) || req.session.role !== 'admin') return res.redirect('/dashboard');
  if (!canAccessPage(req.session.role, 'users', 'view')) return res.redirect('/dashboard');
  const users = queryAll('SELECT * FROM users ORDER BY created_at DESC');
  const getCount = (role) => {
    const result = db.exec(`SELECT COUNT(*) as count FROM users WHERE role = '${role}'`);
    return result.length > 0 ? result[0].values[0][0] : 0;
  };
  const counts = {
    imam: getCount('imam'),
    khadim: getCount('khadim'),
    committee: getCount('committee'),
    volunteer: getCount('volunteer'),
    guest: getCount('guest'),
    total: db.exec("SELECT COUNT(*) as count FROM users")[0].values[0][0]
  };
  res.render('admin-users', { users, counts, currentPage: 'admin' });
});

app.post('/admin/users/:id/update', (req, res) => {
  if (!isLoggedIn(req) || req.session.role !== 'admin') return res.redirect('/dashboard');
  const { name, password } = req.body;
  const userId = parseInt(req.params.id);
  if (userId === 1) return res.redirect('/admin/users');
  
  if (password && password.trim()) {
    const hashed = bcrypt.hashSync(password.trim(), 10);
    runQuery('UPDATE users SET name = ?, password = ? WHERE id = ?', [name, hashed, userId]);
  } else {
    runQuery('UPDATE users SET name = ? WHERE id = ?', [name, userId]);
  }
  res.redirect('/admin/users');
});

app.post('/admin/users/:id/role', (req, res) => {
  if (!isLoggedIn(req) || req.session.role !== 'admin') return res.redirect('/dashboard');
  const { role } = req.body;
  const userId = parseInt(req.params.id);
  
  if (userId === 1) return res.redirect('/admin/users');
  
  runQuery('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
  res.redirect('/admin/users');
});

app.post('/admin/users', (req, res) => {
  if (!isLoggedIn(req) || req.session.role !== 'admin') return res.redirect('/dashboard');
  const { name, email, password, role } = req.body;
  
  if (role === 'admin') return res.redirect('/admin/users');
  
  const hashed = bcrypt.hashSync(password || 'password123', 10);
  runQuery('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashed, role]);
  res.redirect('/admin/users');
});

app.post('/admin/users/:id/delete', (req, res) => {
  if (!isLoggedIn(req) || req.session.role !== 'admin') return res.redirect('/dashboard');
  if (!canAccessPage(req.session.role, 'users', 'edit')) return res.redirect('/dashboard');
  const userId = parseInt(req.params.id);
  if (userId !== 1 && userId !== req.session.userId) {
    runQuery('DELETE FROM users WHERE id = ?', [userId]);
  }
  res.redirect('/admin/users');
});

app.get('/admin/role-pages', (req, res) => {
  if (!isLoggedIn(req) || req.session.role !== 'admin') return res.redirect('/dashboard');
  
  const roles = ['imam', 'khadim', 'committee', 'volunteer', 'guest'];
  const pages = ['prayer_times', 'events', 'announcements', 'sermons', 'meetings', 'finances', 'expenses', 'maintenance', 'users', 'settings'];
  
  const allPermissions = {};
  roles.forEach(role => {
    allPermissions[role] = {};
    pages.forEach(page => {
      const result = db.exec(`SELECT can_view, can_edit FROM role_permissions WHERE role = '${role}' AND page = '${page}'`);
      if (result.length > 0 && result[0].values.length > 0) {
        allPermissions[role][page] = {
          can_view: result[0].values[0][0] === 1,
          can_edit: result[0].values[0][1] === 1
        };
      } else {
        allPermissions[role][page] = { can_view: false, can_edit: false };
      }
    });
  });
  
  res.render('role-permissions', { roles, pages, allPermissions, currentPage: 'role-pages' });
});

app.post('/admin/role-pages', (req, res) => {
  if (!isLoggedIn(req) || req.session.role !== 'admin') return res.redirect('/dashboard');
  
  const { role, page, type, value } = req.body;
  const isOn = value === 'on' || value === '1';
  const field = type === 'edit' ? 'can_edit' : 'can_view';
  
  const existing = db.exec(`SELECT id FROM role_permissions WHERE role = '${role}' AND page = '${page}'`);
  if (existing.length > 0 && existing[0].values.length > 0) {
    db.run(`UPDATE role_permissions SET ${field} = ? WHERE role = ? AND page = ?`, [isOn ? 1 : 0, role, page]);
  } else {
    const canView = type === 'view' ? (isOn ? 1 : 0) : 0;
    const canEdit = type === 'edit' ? (isOn ? 1 : 0) : 0;
    db.run(`INSERT INTO role_permissions (role, page, can_view, can_edit) VALUES (?, ?, ?, ?)`, [role, page, canView, canEdit]);
  }
  saveDB();
  res.redirect('/admin/role-pages');
});

app.post('/admin/role-pages/toggle', (req, res) => {
  if (!isLoggedIn(req) || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  const { role, page, type } = req.body;
  const field = type === 'edit' ? 'can_edit' : 'can_view';
  
  const existing = db.exec(`SELECT ${field} FROM role_permissions WHERE role = '${role}' AND page = '${page}'`);
  const currentValue = existing.length > 0 && existing[0].values.length > 0 ? existing[0].values[0][0] : 0;
  const newValue = currentValue === 1 ? 0 : 1;
  
  if (existing.length > 0 && existing[0].values.length > 0) {
    db.run(`UPDATE role_permissions SET ${field} = ? WHERE role = ? AND page = ?`, [newValue, role, page]);
  } else {
    const canView = type === 'view' ? newValue : 0;
    const canEdit = type === 'edit' ? newValue : 0;
    db.run(`INSERT INTO role_permissions (role, page, can_view, can_edit) VALUES (?, ?, ?, ?)`, [role, page, canView, canEdit]);
  }
  saveDB();
  res.json({ success: true, role, page, type, value: newValue === 1 });
});

app.get('/announcements', (req, res) => {
  if (!isLoggedIn(req)) return res.redirect('/login');
  if (!canAccessPage(req.session.role, 'announcements', 'view')) return res.redirect('/dashboard');
  const announcements = queryAll('SELECT a.*, u.name as author_name FROM announcements a LEFT JOIN users u ON a.author_id = u.id ORDER BY a.created_at DESC');
  const canEdit = canAccessPage(req.session.role, 'announcements', 'edit');
  res.render('announcements', { announcements, canEdit, currentPage: 'announcements' });
});

app.post('/announcements', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'announcements', 'edit')) return res.redirect('/dashboard');
  const { title, body } = req.body;
  runQuery('INSERT INTO announcements (title, body, author_id) VALUES (?, ?, ?)', [title, body, req.session.userId]);
  res.redirect('/announcements');
});

app.post('/announcements/:id/delete', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'announcements', 'edit')) return res.redirect('/dashboard');
  runQuery('DELETE FROM announcements WHERE id = ?', [req.params.id]);
  res.redirect('/announcements');
});

app.get('/prayer-times', (req, res) => {
  if (!isLoggedIn(req)) return res.redirect('/login');
  if (!canAccessPage(req.session.role, 'prayer_times', 'view')) return res.redirect('/dashboard');
  const prayerTimes = queryAll('SELECT pt.*, u.name as updated_by_name FROM prayer_times pt LEFT JOIN users u ON pt.updated_by = u.id ORDER BY pt.id');
  const canEdit = canAccessPage(req.session.role, 'prayer_times', 'edit');
  res.render('prayer-times', { prayerTimes, canEdit, currentPage: 'prayer-times' });
});

app.post('/prayer-times', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'prayer_times', 'edit')) return res.redirect('/dashboard');
  const { id, adhan_time, iqamah_time } = req.body;
  runQuery('UPDATE prayer_times SET adhan_time = ?, iqamah_time = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [adhan_time, iqamah_time, req.session.userId, id]);
  res.redirect('/prayer-times');
});

app.get('/sermons', (req, res) => {
  if (!isLoggedIn(req)) return res.redirect('/login');
  if (!canAccessPage(req.session.role, 'sermons', 'view')) return res.redirect('/dashboard');
  const sermons = queryAll('SELECT s.*, u.name as creator_name FROM sermons s LEFT JOIN users u ON s.created_by = u.id ORDER BY s.sermon_date DESC');
  const canEdit = canAccessPage(req.session.role, 'sermons', 'edit');
  res.render('sermons', { sermons, canEdit, currentPage: 'sermons' });
});

app.post('/sermons', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'sermons', 'edit')) return res.redirect('/dashboard');
  const { title, speaker, description, sermon_date } = req.body;
  runQuery('INSERT INTO sermons (title, speaker, description, sermon_date, created_by) VALUES (?, ?, ?, ?, ?)', [title, speaker, description, sermon_date, req.session.userId]);
  res.redirect('/sermons');
});

app.post('/sermons/:id/delete', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'sermons', 'edit')) return res.redirect('/dashboard');
  runQuery('DELETE FROM sermons WHERE id = ?', [req.params.id]);
  res.redirect('/sermons');
});

app.get('/maintenance', (req, res) => {
  if (!isLoggedIn(req)) return res.redirect('/login');
  if (!canAccessPage(req.session.role, 'maintenance', 'view')) return res.redirect('/dashboard');
  const tasks = queryAll('SELECT t.*, a.name as assigned_name, c.name as created_name FROM maintenance_tasks t LEFT JOIN users a ON t.assigned_to = a.id LEFT JOIN users c ON t.created_by = c.id ORDER BY t.created_at DESC');
  const users = queryAll('SELECT id, name FROM users');
  const canEdit = canAccessPage(req.session.role, 'maintenance', 'edit');
  res.render('maintenance', { tasks, users, canEdit, currentPage: 'maintenance' });
});

app.post('/maintenance', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'maintenance', 'edit')) return res.redirect('/dashboard');
  const { title, description, location, priority, status, assigned_to } = req.body;
  runQuery('INSERT INTO maintenance_tasks (title, description, location, priority, status, assigned_to, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [title, description, location, priority, status, assigned_to || null, req.session.userId]);
  res.redirect('/maintenance');
});

app.post('/maintenance/:id/update', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'maintenance', 'edit')) return res.redirect('/dashboard');
  const { status, assigned_to } = req.body;
  runQuery('UPDATE maintenance_tasks SET status = ?, assigned_to = ? WHERE id = ?', [status, assigned_to || null, req.params.id]);
  res.redirect('/maintenance');
});

app.post('/maintenance/:id/delete', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'maintenance', 'edit')) return res.redirect('/dashboard');
  runQuery('DELETE FROM maintenance_tasks WHERE id = ?', [req.params.id]);
  res.redirect('/maintenance');
});

app.get('/events', (req, res) => {
  if (!isLoggedIn(req)) return res.redirect('/login');
  if (!canAccessPage(req.session.role, 'events', 'view')) return res.redirect('/dashboard');
  const events = queryAll(`
    SELECT e.*, u.name as creator_name,
    (SELECT COUNT(*) FROM event_volunteers WHERE event_id = e.id) as volunteer_count,
    (SELECT COUNT(*) FROM event_attendees WHERE event_id = e.id) as attendee_count
    FROM events e LEFT JOIN users u ON e.created_by = u.id
    ORDER BY e.event_date DESC
  `);
  const myVolunteering = queryAll('SELECT event_id FROM event_volunteers WHERE user_id = ?', [req.session.userId]).map(s => s.event_id);
  const myAttendance = queryAll('SELECT event_id FROM event_attendees WHERE user_id = ?', [req.session.userId]).map(s => s.event_id);
  const canCreate = canAccessPage(req.session.role, 'events', 'edit');
  const user = queryOne('SELECT * FROM users WHERE id = ?', [req.session.userId]);
  res.render('events', { events, myVolunteering, myAttendance, canCreate, user, role: req.session.role, currentPage: 'events' });
});

app.post('/events', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'events', 'edit')) return res.redirect('/dashboard');
  const { title, description, event_date, location, signup_type, max_volunteers, max_attendees } = req.body;
  runQuery('INSERT INTO events (title, description, event_date, location, signup_type, max_volunteers, max_attendees, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
    [title, description, event_date, location, signup_type || 'none', parseInt(max_volunteers) || 0, parseInt(max_attendees) || 0, req.session.userId]);
  res.redirect('/events');
});

app.post('/events/:id/volunteer', (req, res) => {
  if (!isLoggedIn(req) || req.session.role !== 'volunteer') return res.redirect('/dashboard');
  const eventId = parseInt(req.params.id);
  const event = queryOne('SELECT * FROM events WHERE id = ?', [eventId]);
  if (!event || (event.signup_type !== 'volunteer' && event.signup_type !== 'both')) {
    return res.redirect('/events');
  }
  const existing = queryOne('SELECT * FROM event_volunteers WHERE event_id = ? AND user_id = ?', [eventId, req.session.userId]);
  if (existing) {
    runQuery('DELETE FROM event_volunteers WHERE event_id = ? AND user_id = ?', [eventId, req.session.userId]);
  } else {
    if (event.max_volunteers > 0) {
      const count = queryOne('SELECT COUNT(*) as count FROM event_volunteers WHERE event_id = ?', [eventId]).count;
      if (count >= event.max_volunteers) {
        return res.redirect('/events?error=Volunteer+limit+reached');
      }
    }
    runQuery('INSERT INTO event_volunteers (event_id, user_id) VALUES (?, ?)', [eventId, req.session.userId]);
  }
  res.redirect('/events');
});

app.post('/events/:id/attend', (req, res) => {
  if (!isLoggedIn(req) || req.session.role === 'guest') return res.redirect('/dashboard');
  const eventId = parseInt(req.params.id);
  const event = queryOne('SELECT * FROM events WHERE id = ?', [eventId]);
  if (!event || (event.signup_type !== 'attendee' && event.signup_type !== 'both')) {
    return res.redirect('/events');
  }
  const existing = queryOne('SELECT * FROM event_attendees WHERE event_id = ? AND user_id = ?', [eventId, req.session.userId]);
  if (existing) {
    runQuery('DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?', [eventId, req.session.userId]);
  } else {
    if (event.max_attendees > 0) {
      const count = queryOne('SELECT COUNT(*) as count FROM event_attendees WHERE event_id = ?', [eventId]).count;
      if (count >= event.max_attendees) {
        return res.redirect('/events?error=Attendee+limit+reached');
      }
    }
    runQuery('INSERT INTO event_attendees (event_id, user_id) VALUES (?, ?)', [eventId, req.session.userId]);
  }
  res.redirect('/events');
});

app.post('/events/:id/delete', (req, res) => {
  if (!isLoggedIn(req) || !['admin', 'imam', 'committee'].includes(req.session.role)) return res.redirect('/dashboard');
  runQuery('DELETE FROM events WHERE id = ?', [req.params.id]);
  res.redirect('/events');
});

app.get('/meetings', (req, res) => {
  if (!isLoggedIn(req)) return res.redirect('/login');
  if (!canAccessPage(req.session.role, 'meetings', 'view')) return res.redirect('/dashboard');
  const meetings = queryAll('SELECT m.*, u.name as creator_name FROM meetings m LEFT JOIN users u ON m.created_by = u.id ORDER BY m.meeting_date DESC');
  const canEdit = canAccessPage(req.session.role, 'meetings', 'edit');
  res.render('meetings', { meetings, canEdit, currentPage: 'meetings' });
});

app.post('/meetings', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'meetings', 'edit')) return res.redirect('/dashboard');
  const { title, agenda, meeting_date, location } = req.body;
  runQuery('INSERT INTO meetings (title, agenda, meeting_date, location, created_by) VALUES (?, ?, ?, ?, ?)', [title, agenda, meeting_date, location, req.session.userId]);
  res.redirect('/meetings');
});

app.post('/meetings/:id/delete', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'meetings', 'edit')) return res.redirect('/dashboard');
  runQuery('DELETE FROM meetings WHERE id = ?', [req.params.id]);
  res.redirect('/meetings');
});

app.get('/finances', (req, res) => {
  if (!isLoggedIn(req)) return res.redirect('/login');
  if (!canAccessPage(req.session.role, 'finances', 'view')) return res.redirect('/dashboard');
  const finances = queryAll('SELECT f.*, u.name as creator_name FROM finances f LEFT JOIN users u ON f.created_by = u.id ORDER BY f.transaction_date DESC');
  const paidExpenses = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'paid'").total || 0;
  const totals = {
    donation: queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM finances WHERE type = 'donation'").total || 0,
    expense: (queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM finances WHERE type = 'expense'").total || 0) + paidExpenses
  };
  const canEdit = canAccessPage(req.session.role, 'finances', 'edit');
  res.render('finances', { finances, totals, canEdit, currentPage: 'finances' });
});

app.post('/finances', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'finances', 'edit')) return res.redirect('/dashboard');
  const { type, category, amount, description, transaction_date } = req.body;
  runQuery('INSERT INTO finances (type, category, amount, description, transaction_date, created_by) VALUES (?, ?, ?, ?, ?, ?)', [type, category, parseFloat(amount), description, transaction_date, req.session.userId]);
  res.redirect('/finances');
});

app.post('/finances/:id/delete', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'finances', 'edit')) return res.redirect('/dashboard');
  runQuery('DELETE FROM finances WHERE id = ?', [req.params.id]);
  res.redirect('/finances');
});

app.get('/expenses', (req, res) => {
  if (!isLoggedIn(req)) return res.redirect('/login');
  if (!canAccessPage(req.session.role, 'expenses', 'view')) return res.redirect('/dashboard');
  const expenses = queryAll('SELECT e.*, u.name as creator_name FROM expenses e LEFT JOIN users u ON e.created_by = u.id ORDER BY e.expense_date DESC');
  const total = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM expenses").total || 0;
  const canEdit = canAccessPage(req.session.role, 'expenses', 'edit');
  res.render('expenses', { expenses, total, canEdit, currentPage: 'expenses' });
});

app.post('/expenses', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'expenses', 'edit')) return res.redirect('/dashboard');
  const { category, amount, description, expense_date, status } = req.body;
  runQuery('INSERT INTO expenses (category, amount, description, expense_date, status, created_by) VALUES (?, ?, ?, ?, ?, ?)', [category, parseFloat(amount), description, expense_date, status || 'pending', req.session.userId]);
  res.redirect('/expenses');
});

app.post('/expenses/:id/update', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'expenses', 'edit')) return res.redirect('/dashboard');
  const { category, amount, description, expense_date, status } = req.body;
  runQuery('UPDATE expenses SET category = ?, amount = ?, description = ?, expense_date = ?, status = ? WHERE id = ?', [category, parseFloat(amount), description, expense_date, status, req.params.id]);
  res.redirect('/expenses');
});

app.post('/expenses/:id/delete', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'expenses', 'edit')) return res.redirect('/dashboard');
  runQuery('DELETE FROM expenses WHERE id = ?', [req.params.id]);
  res.redirect('/expenses');
});

app.get('/settings', (req, res) => {
  if (!isLoggedIn(req)) return res.redirect('/login');
  if (!canAccessPage(req.session.role, 'settings', 'view')) return res.redirect('/dashboard');
  const canEdit = canAccessPage(req.session.role, 'settings', 'edit');
  res.render('settings', { canEdit, currentPage: 'settings' });
});

app.post('/settings', (req, res) => {
  if (!isLoggedIn(req) || !canAccessPage(req.session.role, 'settings', 'edit')) return res.redirect('/dashboard');
  const { app_name, app_logo, prayer_method, timezone, contact_email, contact_phone, address, currency, donation_goal } = req.body;
  if (app_name) updateSetting('app_name', app_name);
  if (app_logo) updateSetting('app_logo', app_logo);
  if (prayer_method) updateSetting('prayer_method', prayer_method);
  if (timezone) updateSetting('timezone', timezone);
  if (contact_email) updateSetting('contact_email', contact_email);
  if (contact_phone) updateSetting('contact_phone', contact_phone);
  if (address) updateSetting('address', address);
  if (currency) updateSetting('currency', currency);
  if (donation_goal) updateSetting('donation_goal', donation_goal);
  res.redirect('/settings');
});

initDB().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Masjid App running at http://localhost:${PORT}`);
    console.log('Default admin: admin@masjid.com / admin123');
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
