
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

const demoQuestions = [
  {
    id: 'q1',
    section: 'Правило 24',
    question: 'Как должен действовать судья, если игрок совершил нарушение, за которое предусмотрено удаление?',
    options: [
      'Зафиксировать нарушение и назначить предусмотренное правилами наказание',
      'Всегда ограничиваться устным предупреждением',
      'Продолжить игру при любых обстоятельствах',
    ],
    correct: 0,
    explanation: 'Решение принимается по характеру нарушения и соответствующему пункту правил.',
  },
  {
    id: 'q2',
    section: 'Правило 41',
    question: 'Какой фактор имеет значение при оценке силового приёма у борта?',
    options: [
      'Только номер игрока',
      'Характер контакта и обстоятельства игрового эпизода',
      'Только счёт матча',
    ],
    correct: 1,
    explanation: 'Необходимо оценить сам контакт и обстоятельства эпизода по применимому правилу.',
  },
  {
    id: 'q3',
    section: 'Правило 81',
    question: 'Что необходимо учитывать при определении проброса?',
    options: [
      'Только положение вратаря',
      'Только направление движения игроков',
      'Условия пересечения шайбой линии ворот и применимые исключения из правила',
    ],
    correct: 2,
    explanation: 'Проброс оценивается по всем условиям соответствующего правила, включая исключения.',
  },
  {
    id: 'q4',
    section: 'Правило 83',
    question: 'Что проверяют при определении положения «вне игры»?',
    options: [
      'Положение игроков относительно синей линии и шайбы в момент пересечения линии',
      'Только положение центрального нападающего',
      'Только направление броска',
    ],
    correct: 0,
    explanation: 'Для точного решения нужно применять все условия правила о положении вне игры.',
  },
  {
    id: 'q5',
    section: 'Работа бригады',
    question: 'Что важно для взаимодействия судей во время матча?',
    options: [
      'Каждый судья принимает решения независимо от обязанностей коллег',
      'Чёткое взаимодействие и соблюдение распределения обязанностей',
      'Обсуждать каждое решение с игроками',
    ],
    correct: 1,
    explanation: 'Судьи должны работать согласованно в рамках своих обязанностей.',
  },
];

const testTypes = [
  {
    id: 'main',
    title: 'Основной тест',
    description: '30 вопросов из банка правил',
    icon: ClipboardList,
    duration: 40,
    cooldown: '24 часа',
  },
  {
    id: 'review',
    title: 'Работа над ошибками',
    description: '10 вопросов по слабым темам',
    icon: Activity,
    duration: 15,
    cooldown: '12 часов',
  },
  {
    id: 'easy',
    title: 'Лёгкий тест',
    description: 'Короткая тренировка знаний',
    icon: BookOpen,
    duration: 10,
    cooldown: '3 часа',
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
    // Локальное сохранение может быть недоступно в приватном режиме.
  }
}

function makeDemoQuestions(type) {
  let list = [...demoQuestions];

  if (type === 'easy') {
    list = list.slice(0, 3);
  } else if (type === 'review') {
    list = list.slice(0, 4);
  }

  return list.map((question) => ({
    ...question,
    options: [...question.options],
  }));
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
  const [adminQuestions, setAdminQuestions] = useState([]);
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
    if (!supabase) return;

    let mounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (mounted && data.session?.user) {
        await loadUser(data.session.user);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session?.user) {
        loadUser(session.user);
      } else if (mounted) {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadUser(authUser) {
    setUser(authUser);

    if (!supabase) return;

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', authUser.id)
      .maybeSingle();

    setProfile(
      data || {
        id: authUser.id,
        full_name: authUser.user_metadata?.full_name || '',
        email: authUser.email || '',
        role: 'user',
      }
    );
  }

  async function handleAuth(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!supabase) {
      if (!authEmail.trim() || !authPassword) {
        setError('Укажи электронную почту и пароль.');
        return;
      }

      const demoUser = {
        id: 'demo-user',
        email: authEmail.trim(),
        user_metadata: { full_name: authName || 'Арбитр' },
      };

      setUser(demoUser);
      setProfile({
        id: demoUser.id,
        email: demoUser.email,
        full_name: demoUser.user_metadata.full_name,
        role: 'user',
      });
      setNotice('Демонстрационный вход выполнен. Аккаунт не создан на сервере.');
      setPage('home');
      return;
    }

    if (authMode === 'register') {
      const { error: authError } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
        options: {
          data: { full_name: authName.trim() },
        },
      });

      if (authError) {
        setError(authError.message);
      } else {
        setNotice(
          'Регистрация отправлена. Если подтверждение почты включено, проверь свою электронную почту.'
        );
      }
    } else {
      const { data, error: authError } =
        await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });

      if (authError) {
        setError(authError.message);
      } else if (data.user) {
        await loadUser(data.user);
        setPage('home');
      }
    }
  }

  async function logout() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setUser(null);
    setProfile(null);
    setPage('home');
    setNotice('');
    setError('');
    setActiveTest(null);
    setTestResult(null);
  }

  function getCooldown(testId) {
    const last = readLocal('reftest_cooldowns', {});
    const timestamp = last[testId];

    if (!timestamp) return 0;

    const hours = {
      main: 24,
      review: 12,
      easy: 3,
    };

    const remaining =
      timestamp + hours[testId] * 60 * 60 * 1000 - Date.now();

    return Math.max(0, remaining);
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
      setError(`Этот тест пока недоступен. ${cooldownLabel(cooldown)}.`);
      return;
    }

    let testQuestions = makeDemoQuestions(type);

    if (supabase) {
      const { data, error: queryError } = await supabase
        .from('questions')
        .select('id, question_text, explanation, section_id')
        .eq('is_active', true)
        .limit(type === 'main' ? 30 : type === 'review' ? 10 : 10);

      if (queryError) {
        setError(
          'Не удалось загрузить вопросы из базы. Проверь таблицы и политики Supabase.'
        );
        return;
      }

      if (data?.length) {
        setError(
          'Банк вопросов подключён, но безопасная загрузка вариантов ответов и проверка результатов ещё не настроены. Демонстрационный тест не запущен.'
        );
        return;
      }
    }

    setActiveTest(type);
    setQuestions(testQuestions);
    setAnswers({});
    setQuestionIndex(0);
    setSecondsLeft(testTypes.find((item) => item.id === type).duration * 60);
    setPage('test');
  }

  useEffect(() => {
    if (page !== 'test' || !activeTest || testResult) return;

    const timer = setInterval(() => {
      setSecondsLeft((seconds) => {
        if (seconds <= 1) {
          clearInterval(timer);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [page, activeTest, testResult]);

  useEffect(() => {
    if (page === 'test' && activeTest && secondsLeft === 0 && !testResult) {
      finishTest();
    }
  }, [secondsLeft, page, activeTest, testResult]);

  function finishTest() {
    if (!activeTest || testResult) return;

    const correct = questions.reduce((total, question, index) => {
      return total + (answers[index] === question.correct ? 1 : 0);
    }, 0);

    const result = {
      id: `${Date.now()}`,
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

  async function saveAdminQuestion(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!isAdmin || !supabase) {
      setError('Администрирование доступно только администратору с подключённой базой.');
      return;
    }

    if (
      !newQuestion.question.trim() ||
      !newQuestion.option1.trim() ||
      !newQuestion.option2.trim() ||
      !newQuestion.option3.trim()
    ) {
      setError('Заполни вопрос и все три варианта ответа.');
      return;
    }

    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .select('id')
      .eq('title', newQuestion.section.trim())
      .maybeSingle();

    if (sectionError) {
      setError(sectionError.message);
      return;
    }

    let sectionId = section?.id;

    if (!sectionId) {
      const { data: createdSection, error: createSectionError } =
        await supabase
          .from('sections')
          .insert({ title: newQuestion.section.trim() })
          .select('id')
          .single();

      if (createSectionError) {
        setError(createSectionError.message);
        return;
      }

      sectionId = createdSection.id;
    }

    const { data: question, error: questionError } = await supabase
      .from('questions')
      .insert({
        section_id: sectionId,
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
  }

  function Header() {
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
          <button className="btn btn-quiet" onClick={logout}>
            <LogOut size={14} />
            Выйти
          </button>
        ) : (
          <button
            className="btn btn-quiet"
            onClick={() => setPage('profile')}
          >
            <UserRound size={15} />
            Войти
          </button>
        )}
      </header>
    );
  }

  function HomePage() {
    const totalTests = history.length;
    const average = totalTests
      ? Math.round(
          history.reduce((sum, item) => sum + item.percent, 0) / totalTests
        )
      : 0;

    return (
      <>
        <section className="hero">
          <div className="eyebrow">Твоя подготовка начинается здесь</div>
          <h1>
            Стань лучше.
            <br />
            <span>С каждым тестом.</span>
          </h1>
          <p className="muted">
            Тренируй знание хоккейных правил, отслеживай результаты и работай
            над слабыми темами.
          </p>
          <button className="btn" onClick={() => setPage('tests')}>
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
          <button className="btn btn-quiet" onClick={() => setPage('tests')}>
            Все тесты
          </button>
        </div>

        {testTypes.map((test) => {
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
                  onClick={() => startTest(test.id)}
                >
                  Начать
                </button>
              </div>
              <div style={{ marginTop: 13 }}>
                <span className="pill">
                  <Clock3 size={12} style={{ marginRight: 5 }} />
                  {cooldown ? cooldownLabel(cooldown) : test.cooldown}
                </span>
              </div>
            </div>
          );
        })}

        <div className="section-heading">
          <h2>Последние результаты</h2>
          <button
            className="btn btn-quiet"
            onClick={() => setPage('profile')}
          >
            История
          </button>
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
                    {testTypes.find((test) => test.id === item.type)?.title}
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

  function TestsPage() {
    return (
      <>
        <div className="eyebrow">Практика и прогресс</div>
        <h1>Выбери тест</h1>
        <p className="muted">
          Отвечай на вопросы самостоятельно. Итог и разбор появятся после
          завершения тестирования.
        </p>

        {testTypes.map((test) => {
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
                  <p className="muted">Время: {test.duration} мин.</p>
                </div>
              </div>
              <div style={{ marginTop: 17 }}>
                <button
                  className="btn btn-full"
                  onClick={() => startTest(test.id)}
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

  function TestPage() {
    const question = questions[questionIndex];

    if (!question) return null;

    const progress = ((questionIndex + 1) / questions.length) * 100;
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;

    return (
      <>
        <div className="test-top">
          <button
            className="btn btn-quiet"
            onClick={() => {
              if (
                window.confirm(
                  'Выйти из теста? Текущие ответы не будут сохранены.'
                )
              ) {
                setActiveTest(null);
                setPage('tests');
              }
            }}
          >
            <ArrowLeft size={14} /> Выйти
          </button>
          <span className="pill pill-orange">
            <Clock3 size={12} style={{ marginRight: 5 }} />
            {String(minutes).padStart(2, '0')}:
            {String(seconds).padStart(2, '0')}
          </span>
        </div>

        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
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
            onClick={() => setAnswer(questionIndex, index)}
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
            onClick={() => setQuestionIndex((index) => index - 1)}
          >
            Назад
          </button>

          {questionIndex < questions.length - 1 ? (
            <button
              className="btn"
              onClick={() => setQuestionIndex((index) => index + 1)}
            >
              Далее <ArrowRight size={15} />
            </button>
          ) : (
            <button className="btn" onClick={finishTest}>
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

  function ResultPage() {
    if (!testResult) return null;

    return (
      <>
        <div className="card">
          <div className="eyebrow">Тест завершён</div>
          <h1>Твой результат</h1>
          <div className="result-score">
            {testResult.percent}
            <span>%</span>
          </div>
          <p className="muted">
            Правильных ответов: {testResult.correct} из {testResult.total}
          </p>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${testResult.percent}%` }}
            />
          </div>
          <p>
            {testResult.percent >= 85
              ? 'Отличный результат. Продолжай подготовку!'
              : 'Повтори правила по вопросам, в которых ошибся, и попробуй снова после окончания ограничения.'}
          </p>
        </div>

        <div className="section-heading">
          <h2>Разбор ответов</h2>
        </div>

        {testResult.questions.map((question, index) => {
          const selected = testResult.answers[index];
          const isCorrect = selected === question.correct;

          return (
            <div className="card" key={question.id}>
              <div className="card-row">
                {isCorrect ? (
                  <CheckCircle2 color="var(--green)" size={20} />
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
                  Правильный ответ: {question.options[question.correct]}
                </p>
              )}
              <p className="muted">{question.explanation}</p>
            </div>
          );
        })}

        <button
          className="btn btn-full"
          onClick={() => {
            setActiveTest(null);
            setTestResult(null);
            setPage('tests');
          }}
        >
          Вернуться к тестам
        </button>
      </>
    );
  }

  function ProfilePage() {
    if (!user) {
      return (
        <div className="auth-wrap">
          <div className="eyebrow">Личный кабинет</div>
          <h1>{authMode === 'login' ? 'С возвращением' : 'Создай аккаунт'}</h1>
          <p className="muted">
            Войди, чтобы пользоваться личным кабинетом и отслеживать прогресс.
          </p>

          <div className="auth-tabs">
            <button
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => {
                setAuthMode('login');
                setError('');
                setNotice('');
              }}
            >
              Вход
            </button>
            <button
              className={authMode === 'register' ? 'active' : ''}
              onClick={() => {
                setAuthMode('register');
                setError('');
                setNotice('');
              }}
            >
              Регистрация
            </button>
          </div>

          <form className="card" onSubmit={handleAuth}>
            {authMode === 'register' && (
              <div className="field">
                <label>Имя и фамилия</label>
                <input
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                  placeholder="Иван Иванов"
                  required
                />
              </div>
            )}

            <div className="field">
              <label>Электронная почта</label>
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="name@example.com"
                required
              />
            </div>

            <div className="field">
              <label>Пароль</label>
              <input
                type="password"
                minLength={6}
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
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
                Сейчас включён демонстрационный режим. Для настоящей
                регистрации необходимо подключить Supabase.
              </p>
            )}
          </form>
        </div>
      );
    }

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
              {isAdmin && <span className="admin-badge">АДМИНИСТРАТОР</span>}
            </div>
          </div>
        </div>

        <div className="grid">
          <div className="stat">
            <div className="stat-number">{history.length}</div>
            <div className="stat-label">Пройдено тестов</div>
          </div>
          <div className="stat">
            <div className="stat-number">
              {history.length
                ? Math.round(
                    history.reduce((sum, item) => sum + item.percent, 0) /
                      history.length
                  )
                : 0}
              %
            </div>
            <div className="stat-label">Средний результат</div>
          </div>
        </div>

        <div className="section-heading">
          <h2>История тестов</h2>
        </div>

        {history.length === 0 ? (
          <div className="card empty">
            Ты ещё не проходил тесты. Начни с основной тренировки.
          </div>
        ) : (
          history.map((item) => (
            <div className="history-item" key={item.id}>
              <div className="card-row">
                <div className="card-copy">
                  <h3>
                    {testTypes.find((test) => test.id === item.type)?.title}
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

            <form className="card" onSubmit={saveAdminQuestion}>
              <h3>Добавить вопрос</h3>

              <div className="field">
                <label>Раздел или правило</label>
                <input
                  value={newQuestion.section}
                  onChange={(event) =>
                    setNewQuestion({
                      ...newQuestion,
                      section: event.target.value,
                    })
                  }
                  placeholder="Например, Правило 83"
                  required
                />
              </div>

              <div className="field">
                <label>Текст вопроса</label>
                <textarea
                  value={newQuestion.question}
                  onChange={(event) =>
                    setNewQuestion({
                      ...newQuestion,
                      question: event.target.value,
                    })
                  }
                  required
                />
              </div>

              {[1, 2, 3].map((number) => (
                <div className="field" key={number}>
                  <label>Вариант ответа {number}</label>
                  <input
                    value={newQuestion[`option${number}`]}
                    onChange={(event) =>
                      setNewQuestion({
                        ...newQuestion,
                        [`option${number}`]: event.target.value,
                      })
                    }
                    required
                  />
                </div>
              ))}

              <div className="field">
                <label>Правильный ответ</label>
                <select
                  value={newQuestion.correct}
                  onChange={(event) =>
                    setNewQuestion({
                      ...newQuestion,
                      correct: event.target.value,
                    })
                  }
                >
                  <option value="0">Вариант 1</option>
                  <option value="1">Вариант 2</option>
                  <option value="2">Вариант 3</option>
                </select>
              </div>

              <div className="field">
                <label>Объяснение ответа</label>
                <textarea
                  value={newQuestion.explanation}
                  onChange={(event) =>
                    setNewQuestion({
                      ...newQuestion,
                      explanation: event.target.value,
                    })
                  }
                />
              </div>

              {error && <div className="notice error">{error}</div>}
              {notice && <div className="notice success">{notice}</div>}

              <button className="btn btn-full" type="submit">
                Сохранить вопрос
              </button>
            </form>
          </>
        )}
      </>
    );
  }

  return (
    <div className="app">
      <Header />

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

      {page === 'home' && <HomePage />}
      {page === 'tests' && <TestsPage />}
      {page === 'test' && <TestPage />}
      {page === 'result' && <ResultPage />}
      {page === 'profile' && <ProfilePage />}

      <nav className="bottom-nav">
        <button
          className={`nav-btn ${page === 'home' ? 'active' : ''}`}
          onClick={() => {
            setError('');
            setNotice('');
            setPage('home');
          }}
        >
          <span className="nav-symbol">⌂</span>
          Главная
        </button>

        <button
          className={`nav-btn ${
            ['tests', 'test', 'result'].includes(page) ? 'active' : ''
          }`}
          onClick={() => {
            setError('');
            setNotice('');
            setPage('tests');
          }}
        >
          <span className="nav-symbol">▤</span>
          Тесты
        </button>

        <button
          className={`nav-btn ${page === 'profile' ? 'active' : ''}`}
          onClick={() => {
            setError('');
            setNotice('');
            setPage('profile');
          }}
        >
          <span className="nav-symbol">◉</span>
          Профиль
        </button>
      </nav>
    </div>
  );
}
