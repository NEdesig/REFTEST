
import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  ClipboardList,
  LogOut,
  Shield,
  UserRound,
  XCircle,
} from 'lucide-react';
import { supabase } from './lib/supabase';

const TEST_TYPES = [
  {
    id: 'main',
    title: 'Основной тест',
    description: '30 вопросов из банка правил',
    icon: ClipboardList,
    duration: 40,
    cooldown: 24,
  },
  {
    id: 'review',
    title: 'Работа над ошибками',
    description: '10 вопросов по слабым темам',
    icon: Activity,
    duration: 15,
    cooldown: 12,
  },
  {
    id: 'easy',
    title: 'Лёгкий тест',
    description: 'Короткая тренировка знаний',
    icon: BookOpen,
    duration: 10,
    cooldown: 3,
  },
];

const DEMO_QUESTIONS = [
  {
    id: 'q1',
    section: 'Правило 24',
    question:
      'Как должен действовать судья при нарушении, за которое предусмотрено удаление?',
    options: [
      'Зафиксировать нарушение и применить соответствующее наказание',
      'Всегда ограничиваться предупреждением',
      'Продолжить игру при любых обстоятельствах',
    ],
    correct: 0,
    explanation:
      'Решение принимается по характеру нарушения и применимому пункту правил.',
  },
  {
    id: 'q2',
    section: 'Правило 41',
    question: 'Что необходимо учитывать при оценке силового приёма?',
    options: [
      'Только номер игрока',
      'Характер контакта и обстоятельства игрового эпизода',
      'Только счёт матча',
    ],
    correct: 1,
    explanation:
      'Необходимо оценить сам контакт и обстоятельства эпизода.',
  },
  {
    id: 'q3',
    section: 'Правило 81',
    question: 'Что учитывают при определении проброса?',
    options: [
      'Только положение вратаря',
      'Только направление движения игроков',
      'Условия правила и предусмотренные исключения',
    ],
    correct: 2,
    explanation:
      'Нужно учитывать условия применения правила о пробросе и его исключения.',
  },
  {
    id: 'q4',
    section: 'Правило 83',
    question: 'Что проверяют при определении положения «вне игры»?',
    options: [
      'Положение игроков относительно синей линии и шайбы',
      'Только положение центрального нападающего',
      'Только направление броска',
    ],
    correct: 0,
    explanation:
      'Решение принимается с учётом требований правила о положении вне игры.',
  },
  {
    id: 'q5',
    section: 'Работа бригады',
    question: 'Что важно для взаимодействия судей во время матча?',
    options: [
      'Игнорировать обязанности коллег',
      'Согласованная работа и соблюдение распределения обязанностей',
      'Обсуждать каждое решение с игроками',
    ],
    correct: 1,
    explanation:
      'Судьи работают согласованно в пределах своих обязанностей.',
  },
];

function readLocal(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Локальное хранилище может быть недоступно.
  }
}

function formatDate(value) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCooldown(testId) {
  const cooldowns = readLocal('reftest_cooldowns', {});
  const lastTime = cooldowns[testId];

  if (!lastTime) return 0;

  const type = TEST_TYPES.find((item) => item.id === testId);
  if (!type) return 0;

  return Math.max(
    0,
    lastTime + type.cooldown * 60 * 60 * 1000 - Date.now()
  );
}

function cooldownLabel(milliseconds) {
  if (milliseconds <= 0) return 'Доступен';

  const totalMinutes = Math.ceil(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0
    ? `Через ${hours} ч ${minutes} мин`
    : `Через ${minutes} мин`;
}

function makeDemoQuestions(type) {
  const count = type === 'easy' ? 3 : type === 'review' ? 4 : 5;

  return DEMO_QUESTIONS.slice(0, count).map((question) => ({
    ...question,
    options: [...question.options],
  }));
}

/*
 * ВАЖНО:
 * Компоненты страниц находятся вне App.
 * Это предотвращает потерю фокуса в полях ввода
 * при обновлении состояния родительского компонента.
 */

function Header({ user, onLogout, onOpenProfile }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">R</div>
        <div>
          <div className="brand-name">REFTEST</div>
          <div className="brand-subtitle">HOCKEY OFFICIALS</div>
        </div>
      </div>

      {user ? (
        <button className="btn btn-quiet" onClick={onLogout}>
          <LogOut size={14} />
          Выйти
        </button>
      ) : (
        <button className="btn btn-quiet" onClick={onOpenProfile}>
          <UserRound size={15} />
          Войти
        </button>
      )}
    </header>
  );
}

function HomePage({
  history,
  onOpenTests,
  onStartTest,
}) {
  const totalTests = history.length;
  const average = totalTests
    ? Math.round(
        history.reduce((sum, item) => sum + item.percent, 0) /
          totalTests
      )
    : 0;

  return (
    <>
      <section className="hero">
        <div className="eyebrow">
          Твоя подготовка начинается здесь
        </div>

        <h1>
          Стань лучше.
          <br />
          <span>С каждым тестом.</span>
        </h1>

        <p className="muted">
          Тренируй знание хоккейных правил, отслеживай результаты
          и работай над слабыми темами.
        </p>

        <button className="btn" onClick={onOpenTests}>
          К тестам <ArrowRight size={16} />
        </button>
      </section>

      <div className="grid">
        <div className="stat">
          <Activity size={19} color="var(--orange)" />
          <div className="stat-number">{totalTests}</div>
          <div className="stat-label">Пройдено тестов</div>
        </div>

        <div className="stat">
          <CheckCircle2 size={19} color="var(--orange)" />
          <div className="stat-number">{average}%</div>
          <div className="stat-label">Средний результат</div>
        </div>
      </div>

      <div className="section-heading">
        <h2>Тренировки</h2>
        <button className="btn btn-quiet" onClick={onOpenTests}>
          Все тесты
        </button>
      </div>

      {TEST_TYPES.map((test) => {
        const Icon = test.icon;
        const cooldown = getCooldown(test.id);

        return (
          <div className="card" key={test.id}>
            <div className="card-row">
              <div className="card-icon">
                <Icon size={20} />
              </div>

              <div className="card-copy">
                <h3>{test.title}</h3>
                <p className="muted">{test.description}</p>
              </div>

              <button
                className="btn btn-quiet"
                onClick={() => onStartTest(test.id)}
              >
                Начать
              </button>
            </div>

            <div style={{ marginTop: 13 }}>
              <span className="pill">
                <Clock3
                  size={12}
                  style={{ marginRight: 5 }}
                />
                {cooldown
                  ? cooldownLabel(cooldown)
                  : `Интервал: ${test.cooldown} ч`}
              </span>
            </div>
          </div>
        );
      })}

      <div className="section-heading">
        <h2>Последние результаты</h2>
      </div>

      {history.length === 0 ? (
        <div className="card empty">
          Здесь появятся результаты твоих тренировок.
        </div>
      ) : (
        history.slice(0, 3).map((item) => (
          <div className="history-item" key={item.id}>
            <div className="card-row">
              <div>
                <h3>
                  {TEST_TYPES.find(
                    (test) => test.id === item.type
                  )?.title || 'Тест'}
                </h3>
                <p className="muted">{formatDate(item.date)}</p>
              </div>

              <span className="pill pill-orange">
                {item.correct}/{item.total} · {item.percent}%
              </span>
            </div>
          </div>
        ))
      )}
    </>
  );
}

function TestsPage({ onStartTest }) {
  return (
    <>
      <div className="eyebrow">Практика и прогресс</div>
      <h1>Выбери тест</h1>

      <p className="muted">
        Отвечай самостоятельно. Результат и разбор появятся
        после завершения тестирования.
      </p>

      {TEST_TYPES.map((test) => {
        const Icon = test.icon;
        const cooldown = getCooldown(test.id);

        return (
          <div className="card" key={test.id}>
            <div className="card-row">
              <div className="card-icon">
                <Icon size={20} />
              </div>

              <div className="card-copy">
                <h3>{test.title}</h3>
                <p className="muted">{test.description}</p>
                <p className="muted">
                  Время: {test.duration} мин.
                </p>
                <p className="muted">
                  Повторная попытка: {test.cooldown} ч
                </p>
              </div>
            </div>

            <div style={{ marginTop: 17 }}>
              <button
                className="btn btn-full"
                disabled={cooldown > 0}
                onClick={() => onStartTest(test.id)}
              >
                {cooldown
                  ? cooldownLabel(cooldown)
                  : 'Начать тест'}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

function TestPage({
  questions,
  answers,
  questionIndex,
  secondsLeft,
  onSetAnswer,
  onSetQuestionIndex,
  onFinish,
  onExit,
}) {
  const question = questions[questionIndex];

  if (!question) return null;

  const progress =
    ((questionIndex + 1) / questions.length) * 100;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <>
      <div className="test-top">
        <button className="btn btn-quiet" onClick={onExit}>
          <ArrowLeft size={14} /> Выйти
        </button>

        <span className="pill pill-orange">
          <Clock3
            size={12}
            style={{ marginRight: 5 }}
          />
          {String(minutes).padStart(2, '0')}:
          {String(seconds).padStart(2, '0')}
        </span>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="muted">
        Вопрос {questionIndex + 1} из {questions.length}
      </p>

      <span className="pill">{question.section}</span>

      <h2 className="test-question">{question.question}</h2>

      {question.options.map((option, index) => (
        <button
          key={`${question.id}-${index}`}
          className={`answer-option ${
            answers[questionIndex] === index ? 'selected' : ''
          }`}
          onClick={() => onSetAnswer(questionIndex, index)}
        >
          <span className="option-letter">
            {String.fromCharCode(65 + index)}
          </span>
          <span>{option}</span>
        </button>
      ))}

      <div className="test-actions">
        <button
          className="btn btn-secondary"
          disabled={questionIndex === 0}
          onClick={() =>
            onSetQuestionIndex((index) => index - 1)
          }
        >
          Назад
        </button>

        {questionIndex < questions.length - 1 ? (
          <button
            className="btn"
            onClick={() =>
              onSetQuestionIndex((index) => index + 1)
            }
          >
            Далее <ArrowRight size={15} />
          </button>
        ) : (
          <button className="btn" onClick={onFinish}>
            Завершить
          </button>
        )}
      </div>

      <p className="muted">
        Ответы: {Object.keys(answers).length} из {questions.length}
      </p>
    </>
  );
}

function ResultPage({ result, onBack }) {
  if (!result) return null;

  return (
    <>
      <div className="card">
        <div className="eyebrow">Тест завершён</div>
        <h1>Твой результат</h1>

        <div className="result-score">
          {result.percent}
          <span>%</span>
        </div>

        <p className="muted">
          Правильных ответов: {result.correct} из {result.total}
        </p>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${result.percent}%` }}
          />
        </div>

        <p>
          {result.percent >= 85
            ? 'Отличный результат. Продолжай подготовку!'
            : 'Повтори правила по вопросам, в которых ошибся.'}
        </p>
      </div>

      <div className="section-heading">
        <h2>Разбор ответов</h2>
      </div>

      {result.questions.map((question, index) => {
        const selected = result.answers[index];
        const isCorrect = selected === question.correct;

        return (
          <div className="card" key={question.id}>
            <div className="card-row">
              {isCorrect ? (
                <CheckCircle2
                  color="var(--green)"
                  size={20}
                />
              ) : (
                <XCircle color="var(--red)" size={20} />
              )}

              <div className="card-copy">
                <h3>
                  Вопрос {index + 1} · {question.section}
                </h3>
                <p className="muted">{question.question}</p>
              </div>
            </div>

            <p className="muted">
              Твой ответ:{' '}
              {selected === undefined
                ? 'Нет ответа'
                : question.options[selected]}
            </p>

            {!isCorrect && (
              <p className="muted">
                Правильный ответ:{' '}
                {question.options[question.correct]}
              </p>
            )}

            <p className="muted">{question.explanation}</p>
          </div>
        );
      })}

      <button className="btn btn-full" onClick={onBack}>
        Вернуться к тестам
      </button>
    </>
  );
}

function ProfilePage({
  user,
  profile,
  authMode,
  setAuthMode,
  authName,
  setAuthName,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  error,
  notice,
  onAuth,
  history,
  isAdmin,
  newQuestion,
  setNewQuestion,
  onSaveQuestion,
}) {
  if (!user) {
    return (
      <div className="auth-wrap">
        <div className="eyebrow">Личный кабинет</div>

        <h1>
          {authMode === 'login'
            ? 'С возвращением'
            : 'Создай аккаунт'}
        </h1>

        <p className="muted">
          Войди, чтобы пользоваться личным кабинетом
          и отслеживать прогресс.
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={authMode === 'login' ? 'active' : ''}
            onClick={() => setAuthMode('login')}
          >
            Вход
          </button>

          <button
            type="button"
            className={authMode === 'register' ? 'active' : ''}
            onClick={() => setAuthMode('register')}
          >
            Регистрация
          </button>
        </div>

        <form className="card" onSubmit={onAuth}>
          {authMode === 'register' && (
            <div className="field">
              <label htmlFor="auth-name">Имя и фамилия</label>
              <input
                id="auth-name"
                name="fullName"
                autoComplete="name"
                value={authName}
                onChange={(event) =>
                  setAuthName(event.target.value)
                }
                placeholder="Иван Иванов"
                required
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email">Электронная почта</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              value={authEmail}
              onChange={(event) =>
                setAuthEmail(event.target.value)
              }
              placeholder="name@example.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Пароль</label>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={
                authMode === 'login'
                  ? 'current-password'
                  : 'new-password'
              }
              minLength={6}
              value={authPassword}
              onChange={(event) =>
                setAuthPassword(event.target.value)
              }
              placeholder="Не менее 6 символов"
              required
            />
          </div>

          {error && <div className="notice error">{error}</div>}
          {notice && <div className="notice">{notice}</div>}

          <button className="btn btn-full" type="submit">
            {authMode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>

          {!supabase && (
            <p className="muted">
              Supabase не подключён. Проверь файл
              src/lib/supabase.js.
            </p>
          )}
        </form>
      </div>
    );
  }

  const average = history.length
    ? Math.round(
        history.reduce((sum, item) => sum + item.percent, 0) /
          history.length
      )
    : 0;

  return (
    <>
      <div className="eyebrow">Личный кабинет</div>
      <h1>Мой профиль</h1>

      <div className="card">
        <div className="card-row">
          <div className="card-icon">
            <UserRound size={22} />
          </div>

          <div className="card-copy">
            <h3>{profile?.full_name || user.email}</h3>
            <p className="muted">{user.email}</p>
            {isAdmin && (
              <span className="admin-badge">АДМИНИСТРАТОР</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="stat">
          <div className="stat-number">{history.length}</div>
          <div className="stat-label">Пройдено тестов</div>
        </div>

        <div className="stat">
          <div className="stat-number">{average}%</div>
          <div className="stat-label">Средний результат</div>
        </div>
      </div>

      <div className="section-heading">
        <h2>История тестов</h2>
      </div>

      {history.length === 0 ? (
        <div className="card empty">
          Ты ещё не проходил тесты.
        </div>
      ) : (
        history.map((item) => (
          <div className="history-item" key={item.id}>
            <div className="card-row">
              <div className="card-copy">
                <h3>
                  {TEST_TYPES.find(
                    (test) => test.id === item.type
                  )?.title || 'Тест'}
                </h3>
                <p className="muted">{formatDate(item.date)}</p>
              </div>

              <span className="pill pill-orange">
                {item.correct}/{item.total} · {item.percent}%
              </span>
            </div>
          </div>
        ))
      )}

      {isAdmin && (
        <>
          <div className="section-heading">
            <h2>Администрирование</h2>
            <Shield size={18} color="var(--orange)" />
          </div>

          <form className="card" onSubmit={onSaveQuestion}>
            <h3>Добавить вопрос</h3>

            <div className="field">
              <label htmlFor="question-section">
                Раздел или правило
              </label>
              <input
                id="question-section"
                value={newQuestion.section}
                onChange={(event) =>
                  setNewQuestion((previous) => ({
                    ...previous,
                    section: event.target.value,
                  }))
                }
                placeholder="Например, Правило 83"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="question-text">Текст вопроса</label>
              <textarea
                id="question-text"
                value={newQuestion.question}
                onChange={(event) =>
                  setNewQuestion((previous) => ({
                    ...previous,
                    question: event.target.value,
                  }))
                }
                required
              />
            </div>

            {[1, 2, 3].map((number) => (
              <div className="field" key={number}>
                <label htmlFor={`option-${number}`}>
                  Вариант ответа {number}
                </label>
                <input
                  id={`option-${number}`}
                  value={newQuestion[`option${number}`]}
                  onChange={(event) =>
                    setNewQuestion((previous) => ({
                      ...previous,
                      [`option${number}`]: event.target.value,
                    }))
                  }
                  required
                />
              </div>
            ))}

            <div className="field">
              <label htmlFor="correct-option">
                Правильный ответ
              </label>
              <select
                id="correct-option"
                value={newQuestion.correct}
                onChange={(event) =>
                  setNewQuestion((previous) => ({
                    ...previous,
                    correct: event.target.value,
                  }))
                }
              >
                <option value="0">Вариант 1</option>
                <option value="1">Вариант 2</option>
                <option value="2">Вариант 3</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="question-explanation">
                Объяснение ответа
              </label>
              <textarea
                id="question-explanation"
                value={newQuestion.explanation}
                onChange={(event) =>
                  setNewQuestion((previous) => ({
                    ...previous,
                    explanation: event.target.value,
                  }))
                }
              />
            </div>

            {error && <div className="notice error">{error}</div>}
            {notice && (
              <div className="notice success">{notice}</div>
            )}

            <button className="btn btn-full" type="submit">
              Сохранить вопрос
            </button>
          </form>
        </>
      )}
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [page, setPage] = useState('home');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState(() =>
    readLocal('reftest_history', [])
  );
  const [activeTest, setActiveTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [testResult, setTestResult] = useState(null);
  const [newQuestion, setNewQuestion] = useState({
    section: '',
    question: '',
    option1: '',
    option2: '',
    option3: '',
    correct: '0',
    explanation: '',
  });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!supabase) return undefined;

    let mounted = true;

    async function loadUser(authUser) {
      if (!mounted) return;

      setUser(authUser);

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!mounted) return;

      setProfile(
        !profileError && data
          ? data
          : {
              id: authUser.id,
              full_name:
                authUser.user_metadata?.full_name || '',
              email: authUser.email || '',
              role: 'user',
            }
      );
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted && data.session?.user) {
          loadUser(data.session.user);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('Не удалось проверить сессию. Попробуй обновить страницу.');
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleAuth(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!supabase) {
      setError(
        'Supabase не подключён. Проверь src/lib/supabase.js и настройки проекта.'
      );
      return;
    }

    if (!authEmail.trim() || !authPassword) {
      setError('Укажи электронную почту и пароль.');
      return;
    }

    try {
      if (authMode === 'register') {
        if (!authName.trim()) {
          setError('Укажи имя и фамилию.');
          return;
        }

        const { data, error: authError } =
          await supabase.auth.signUp({
            email: authEmail.trim(),
            password: authPassword,
            options: {
              data: {
                full_name: authName.trim(),
              },
            },
          });

        if (authError) {
          setError(authError.message);
          return;
        }

        if (data.session?.user) {
          setNotice('Аккаунт создан. Добро пожаловать в REFTEST!');
          setPage('home');
        } else {
          setNotice(
            'Регистрация отправлена. Если подтверждение почты включено, проверь свою электронную почту.'
          );
        }

        return;
      }

      const { data, error: authError } =
        await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });

      if (authError) {
        setError(
          authError.message === 'Invalid login credentials'
            ? 'Неверная почта или пароль.'
            : authError.message
        );
        return;
      }

      if (data.user) {
        setUser(data.user);
        setPage('home');
        setNotice('Вход выполнен.');
      }
    } catch (authError) {
      setError(
        authError?.message ||
          'Не удалось подключиться к Supabase. Проверь URL проекта.'
      );
    }
  }

  async function logout() {
    setError('');
    setNotice('');

    if (supabase) {
      const { error: logoutError } = await supabase.auth.signOut();

      if (logoutError) {
        setError(logoutError.message);
        return;
      }
    }

    setUser(null);
    setProfile(null);
    setPage('home');
    setActiveTest(null);
    setTestResult(null);
    setQuestions([]);
    setAnswers({});
  }

  async function startTest(type) {
    setError('');
    setNotice('');
    setTestResult(null);

    if (!user) {
      setPage('profile');
      setError('Войди в аккаунт, чтобы начать тест.');
      return;
    }

    const cooldown = getCooldown(type);

    if (cooldown > 0) {
      setError(
        `Этот тест пока недоступен. ${cooldownLabel(cooldown)}.`
      );
      return;
    }

    if (supabase) {
      const { data, error: queryError } = await supabase
        .from('questions')
        .select('id')
        .eq('is_active', true)
        .limit(1);

      if (queryError) {
        setError(
          'Не удалось проверить банк вопросов. Проверь таблицы и политики Supabase.'
        );
        return;
      }

      if (data?.length) {
        setError(
          'Банк вопросов подключён, но безопасная выдача вариантов и проверка ответов ещё не настроены. Тест не запущен.'
        );
        return;
      }
    }

    const demoQuestions = makeDemoQuestions(type);

    setActiveTest(type);
    setQuestions(demoQuestions);
    setAnswers({});
    setQuestionIndex(0);

    const test = TEST_TYPES.find((item) => item.id === type);
    setSecondsLeft((test?.duration || 10) * 60);
    setPage('test');
  }

  function finishTest() {
    if (!activeTest || testResult) return;

    const correct = questions.reduce(
      (total, question, index) =>
        total + (answers[index] === question.correct ? 1 : 0),
      0
    );

    const result = {
      id: String(Date.now()),
      type: activeTest,
      date: new Date().toISOString(),
      correct,
      total: questions.length,
      percent: questions.length
        ? Math.round((correct / questions.length) * 100)
        : 0,
      answers: { ...answers },
      questions: questions.map((question) => ({
        ...question,
        options: [...question.options],
      })),
    };

    const updatedHistory = [result, ...history];

    setHistory(updatedHistory);
    saveLocal('reftest_history', updatedHistory);

    const cooldowns = readLocal('reftest_cooldowns', {});
    cooldowns[activeTest] = Date.now();
    saveLocal('reftest_cooldowns', cooldowns);

    setTestResult(result);
    setPage('result');
  }

  function setAnswer(index, optionIndex) {
    setAnswers((previous) => ({
      ...previous,
      [index]: optionIndex,
    }));
  }

  useEffect(() => {
    if (page !== 'test' || !activeTest || testResult) {
      return undefined;
    }

    const timer = setInterval(() => {
      setSecondsLeft((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [page, activeTest, testResult]);

  useEffect(() => {
    if (
      page === 'test' &&
      activeTest &&
      secondsLeft === 0 &&
      !testResult
    ) {
      finishTest();
    }
  }, [secondsLeft, page, activeTest, testResult]);

  async function saveAdminQuestion(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!isAdmin || !supabase) {
      setError(
        'Администрирование доступно только администратору с подключённой базой.'
      );
      return;
    }

    if (
      !newQuestion.section.trim() ||
      !newQuestion.question.trim() ||
      !newQuestion.option1.trim() ||
      !newQuestion.option2.trim() ||
      !newQuestion.option3.trim()
    ) {
      setError('Заполни раздел, вопрос и все три варианта ответа.');
      return;
    }

    try {
      let { data: section, error: sectionError } = await supabase
        .from('sections')
        .select('id')
        .eq('title', newQuestion.section.trim())
        .maybeSingle();

      if (sectionError) {
        setError(sectionError.message);
        return;
      }

      if (!section) {
        const { data, error: createSectionError } = await supabase
          .from('sections')
          .insert({ title: newQuestion.section.trim() })
          .select('id')
          .single();

        if (createSectionError) {
          setError(createSectionError.message);
          return;
        }

        section = data;
      }

      const { data: question, error: questionError } = await supabase
        .from('questions')
        .insert({
          section_id: section.id,
          question_text: newQuestion.question.trim(),
          explanation: newQuestion.explanation.trim(),
          is_active: true,
        })
        .select('id')
        .single();

      if (questionError) {
        setError(questionError.message);
        return;
      }

      const options = [
        newQuestion.option1,
        newQuestion.option2,
        newQuestion.option3,
      ].map((text, index) => ({
        question_id: question.id,
        option_text: text.trim(),
        is_correct: index === Number(newQuestion.correct),
      }));

      const { error: optionsError } = await supabase
        .from('question_options')
        .insert(options);

      if (optionsError) {
        setError(
          `Вопрос создан, но варианты не сохранены: ${optionsError.message}`
        );
        return;
      }

      setNotice('Вопрос добавлен в банк.');

      setNewQuestion({
        section: '',
        question: '',
        option1: '',
        option2: '',
        option3: '',
        correct: '0',
        explanation: '',
      });
    } catch (saveError) {
      setError(
        saveError?.message || 'Не удалось сохранить вопрос.'
      );
    }
  }

  function exitTest() {
    const confirmed = window.confirm(
      'Выйти из теста? Текущие ответы не будут сохранены.'
    );

    if (!confirmed) return;

    setActiveTest(null);
    setQuestions([]);
    setAnswers({});
    setPage('tests');
  }

  function openPage(nextPage) {
    setError('');
    setNotice('');
    setPage(nextPage);
  }

  return (
    <div className="app">
      <Header
        user={user}
        onLogout={logout}
        onOpenProfile={() => openPage('profile')}
      />

      {error && page !== 'profile' && (
        <div className="notice error">
          {error}
          <button
            className="btn btn-quiet"
            style={{ marginLeft: 8 }}
            onClick={() => setError('')}
          >
            Закрыть
          </button>
        </div>
      )}

      {notice && page !== 'profile' && (
        <div className="notice">{notice}</div>
      )}

      {page === 'home' && (
        <HomePage
          history={history}
          onOpenTests={() => openPage('tests')}
          onStartTest={startTest}
        />
      )}

      {page === 'tests' && (
        <TestsPage onStartTest={startTest} />
      )}

      {page === 'test' && (
        <TestPage
          questions={questions}
          answers={answers}
          questionIndex={questionIndex}
          secondsLeft={secondsLeft}
          onSetAnswer={setAnswer}
          onSetQuestionIndex={setQuestionIndex}
          onFinish={finishTest}
          onExit={exitTest}
        />
      )}

      {page === 'result' && (
        <ResultPage
          result={testResult}
          onBack={() => {
            setActiveTest(null);
            setTestResult(null);
            setPage('tests');
          }}
        />
      )}

      {page === 'profile' && (
        <ProfilePage
          user={user}
          profile={profile}
          authMode={authMode}
          setAuthMode={(mode) => {
            setAuthMode(mode);
            setError('');
            setNotice('');
          }}
          authName={authName}
          setAuthName={setAuthName}
          authEmail={authEmail}
          setAuthEmail={setAuthEmail}
          authPassword={authPassword}
          setAuthPassword={setAuthPassword}
          error={error}
          notice={notice}
          onAuth={handleAuth}
          history={history}
          isAdmin={isAdmin}
          newQuestion={newQuestion}
          setNewQuestion={setNewQuestion}
          onSaveQuestion={saveAdminQuestion}
        />
      )}

      <nav className="bottom-nav">
        <button
          className={`nav-btn ${page === 'home' ? 'active' : ''}`}
          onClick={() => openPage('home')}
        >
          <span className="nav-symbol">⌂</span>
          Главная
        </button>

        <button
          className={`nav-btn ${
            ['tests', 'test', 'result'].includes(page)
              ? 'active'
              : ''
          }`}
          onClick={() => openPage('tests')}
        >
          <span className="nav-symbol">▤</span>
          Тесты
        </button>

        <button
          className={`nav-btn ${page === 'profile' ? 'active' : ''}`}
          onClick={() => openPage('profile')}
        >
          <span className="nav-symbol">◉</span>
          Профиль
        </button>
      </nav>
    </div>
  );
}
