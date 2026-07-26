(() => {
  'use strict';

  const API = '/api/fototime';
  const COST = 40;

  const SESSION_ID = (() => {
    const key = 'fototime-session-v14';
    let value = sessionStorage.getItem(key);

    if (!value) {
      value = `session_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
      sessionStorage.setItem(key, value);
    }

    return value;
  })();

  const USER = getUser();

  const state = {
    page: 'home',
    theme: localStorage.getItem('fototime-theme-v14') || 'light',
    language: localStorage.getItem('fototime-language-v1') || 'ru',
    currency: localStorage.getItem('fototime-currency-v1') || 'RUB',
    user: USER,
    balance: 50,
    cost: COST,
    styles: [],
    selectedStyle: null,
    participant: 'male',
    styleFilter: 'Все',
    search: '',
    // Two real catalogue layouts: compact tiles and a swipeable horizontal strip.
    // This is a presentation choice only; it never moves the user through the form.
    view: ['grid', 'carousel'].includes(localStorage.getItem('fototime-view-v14'))
      ? localStorage.getItem('fototime-view-v14')
      : 'grid',
    perPage: [6, 9, 12].includes(Number(localStorage.getItem('fototime-per-page-v14')))
      ? Number(localStorage.getItem('fototime-per-page-v14'))
      : 6,
    pageIndex: 0,
    file: null,
    filePreview: '',
    generations: [],
    currentResult: null,
    historySelectMode: false,
    historySelected: [],
    notifications: [],
    version: 'fot-ai-local',
    authToken: sessionStorage.getItem('fot-ai-identity-session-v1') || '',
    installHintVisible: localStorage.getItem('fot-ai-install-hint-v1') !== 'hidden',
    admin: null,
    adminPin: '',
    busy: false,
    progress: null,
    message: null,
  };

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>"]/g,
      (m) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
        })[m],
    );

  const norm = (value) =>
    String(value || '')
      .trim()
      .toLowerCase();

  const TRANSLATIONS = {
    en: {
      'Сменить тему:': 'Theme:',
      'Настройки отображения': 'Display settings',
      Тема: 'Theme',
      Язык: 'Language',
      Валюта: 'Currency',
      Светлая: 'Light',
      Тёмная: 'Dark',
      Ретро: 'Retro',
      'Язык:': 'Language:',
      Главная: 'Home',
      'Личный кабинет': 'Account',
      Админ: 'Admin',
      Баланс: 'Balance',
      кредитов: 'credits',
      'Выберите участника, стиль обработки и загрузите фото. Приложение покажет только стили, доступные для текущего режима.':
        'Choose a participant, processing style, and upload a photo. The app will show only styles available for the current mode.',
      'Пополнить баланс': 'Add credits',
      'Обновить баланс': 'Refresh balance',
      'Авторизация и бонусы': 'Sign-in and bonuses',
      Доступно: 'Available',
      'Стоимость генерации': 'Generation cost',
      'Хватит примерно': 'Approximately',
      генераций: 'generations',
      'Пакеты кредитов': 'Credit packages',
      'Запросить токены': 'Request credits',
      'Мои сгенерированные фото': 'My generated images',
      'История пока пустая.': 'History is empty.',
      Выбрать: 'Select',
      'Выбрать все': 'Select all',
      'Отменить выбор': 'Cancel selection',
      Скачать: 'Download',
      Удалить: 'Delete',
      Выбрано: 'Selected',
      'Контакты и аренда по Краснодарскому краю.': 'Contacts and rentals in Krasnodar Region.',
      'Обратная связь': 'Feedback',
      Отправить: 'Send',
      'Админ-консоль': 'Admin console',
      Войти: 'Sign in',
      'Вход в админ-консоль': 'Admin sign-in',
      'PIN администратора': 'Admin PIN',
      'Введите PIN администратора': 'Enter the administrator PIN',
      'Введите PIN администратора. Личный кабинет и баланс этот PIN не запрашивают.':
        'Enter the administrator PIN. Your account and balance never request this PIN.',
      'Удалить выбранные': 'Delete selected',
      Design: 'Design',
      Результат: 'Result',
      'Скачать изображение': 'Download image',
      Поделиться: 'Share',
      'Создать ещё одно': 'Create another',
      'Личный кабинет FOT AI': 'FOT AI account',
      Обновить: 'Refresh',
      'Уведомления: 0 новых': 'Notifications: 0 new',
      'Оплата через Telegram. После оплаты начисляем кредиты вручную и отправляем чек.':
        'Payment via Telegram. Credits are added manually after payment and a receipt is sent.',
      'Итоговая сумма и реквизиты подтверждаются до оплаты. После оплаты вы получите чек самозанятого.':
        'The final amount and payment details are confirmed before payment. You will receive a self-employed receipt after payment.',
      Старт: 'Start',
      Комфорт: 'Comfort',
      Популярный: 'Popular',
      Максимум: 'Maximum',
      Сайт: 'Website',
      'Опишите ошибку или идею улучшения.': 'Describe an error or improvement idea.',
      'Тип обращения': 'Request type',
      Отзыв: 'Feedback',
      Ошибка: 'Error',
      'Идея улучшения': 'Improvement idea',
      Имя: 'Name',
      'Telegram для связи': 'Telegram contact',
      Сообщение: 'Message',
      Скриншот: 'Screenshot',
      Пользователи: 'Users',
      Сохранить: 'Save',
      'Чек самозанятого': 'Self-employed receipt',
      'Критические ошибки': 'Critical errors',
      'Критичных ошибок нет.': 'No critical errors.',
      'Активные генерации': 'Active generations',
      'Активных генераций сейчас нет.': 'No active generations.',
      'Сообщений пока нет.': 'No messages.',
      'Фото пользователей: до / после': 'User photos: before / after',
      'Сменить аккаунт': 'Switch account',
      'Фото пока нет.': 'No photos yet.',
      'Аудит по сессиям': 'Session audit',
      Выйти: 'Sign out',
      'Отметить всё прочитанным': 'Mark all as read',
      'Скачать аудит': 'Download audit',
      'Поделиться выбранными': 'Share selected',
      'Поделиться фото': 'Share photo',
      'Валюта:': 'Currency:',
      Версия: 'Version',
      'Кредиты для AI-генераций': 'Credits for AI generations',
      'Гостевой режим': 'Guest mode',
      'Пробный баланс доступен для тестирования. Для сохранения истории откройте приложение через Telegram.':
        'Trial credits are available for testing. Open the app through Telegram to save your history.',
      'Как авторизоваться?': 'How to sign in?',
      'Telegram привязан': 'Telegram connected',
      'Баланс и генерации сохраняются в личном кабинете.':
        'Balance and generations are saved in your account.',
      Участник: 'Participant',
      'Тестовое мероприятие FOT AI': 'FOT AI test event',
      Мужчина: 'Man',
      Женщина: 'Woman',
      Пара: 'Couple',
      Мальчик: 'Boy',
      Девочка: 'Girl',
      Семья: 'Family',
      'Стиль обработки': 'Processing style',
      'Выберите стиль для генерации': 'Choose a style for generation',
      Фото: 'Photo',
      'Выбрать фото': 'Choose photo',
      'Лучше загрузить портретное фото, где хорошо видно лицо':
        'A portrait with a clearly visible face works best.',
      'Создать AI-фото': 'Create AI photo',
      'Выберите стиль обработки': 'Choose a processing style',
      'На экране': 'On screen',
      'Стили не найдены. Измените фильтр или поисковый запрос.':
        'No styles found. Change the filter or search.',
      'Гостевой профиль': 'Guest profile',
      'Выберите аватар и градиент — настройки сохранятся для этого устройства.':
        'Choose an avatar and gradient — settings are saved on this device.',
      'Чеки об оплате': 'Payment receipts',
      'Все прикреплённые чеки доступны только этому аккаунту.':
        'All attached receipts are available only to this account.',
      'Чеки пока не прикреплены.': 'No receipts have been attached yet.',
      'Локальное имя': 'Local name',
      'Только для админки': 'Admin only',
      Переименовать: 'Rename',
      'Приложить чек': 'Attach receipt',
      'Загрузить админку': 'Open admin console',
      'Аудит, обращения, пользователи и генерации.': 'Audit, requests, users and generations.',
      Прочитано: 'Read',
      Стабильность: 'Stability',
      Сообщения: 'Messages',
      Фото: 'Photos',
      Активные: 'Active',
      обращений: 'requests',
      сохранено: 'saved',
      ошибок: 'errors',
      генерация: 'generation',
      Все: 'All',
      'Поиск по стилю или нейросети...': 'Search by style or model...',
      Плитка: 'Grid',
      Карусель: 'Carousel',
      Лента: 'Carousel',
      'Вид каталога': 'Catalog layout',
      'Плитка или лента: выберите стиль, затем загрузите фото.':
        'Grid or carousel: choose a style, then upload a photo.',
      'Установка приложения': 'Install application',
      'JPG, JPEG или PNG до 10 МБ': 'JPG, JPEG or PNG up to 10 MB',
      'Добавьте FOT AI на экран': 'Add FOT AI to your home screen',
      'В браузере: «Поделиться» → «На экран Домой» или «Установить приложение».':
        'In your browser: Share → Add to Home Screen or Install app.',
      'Добро пожаловать в FOT AI': 'Welcome to FOT AI',
      'Выберите, как начать. Гостевой режим подходит для знакомства, а аккаунт по логину сохраняет историю и чеки для восстановления на другом устройстве.':
        'Choose how to begin. Guest mode is ideal for exploring, while a login account saves your history and receipts so they can be restored on another device.',
      'Продолжить как гость': 'Continue as guest',
      'Войти по логину': 'Sign in with a login',
      'Выберите аватар гостя и фон прямо сейчас:': 'Choose a guest avatar and background now:',
      'Так будет выглядеть ваш профиль': 'This is how your profile will look',
      lime: 'Lime',
      violet: 'Violet',
      sunset: 'Sunset',
      ocean: 'Ocean',
      'Открыть через Telegram': 'Open in Telegram',
      Понятно: 'Got it',
      'Вход на этом устройстве': 'Sign in on this device',
      'Для первого входа создайте личный профиль. Он хранит только данные, созданные вами в FOT AI.':
        'For your first sign-in, create a personal profile. It stores only the data you create in FOT AI.',
      Логин: 'Login',
      Пароль: 'Password',
      'например, natalia': 'for example, natalia',
      'не менее 10 символов': 'at least 10 characters',
      'Я согласен(на) на обработку моих данных для работы FOT AI. Фото, генерации, чеки и история удаляются через 14 дней; данные собираются только после самостоятельной регистрации.':
        'I consent to the processing of my data for FOT AI. Photos, generations, receipts, and history are deleted after 14 days; data is collected only after I register voluntarily.',
      'Создать профиль': 'Create profile',
      Закрыть: 'Close',
      'Введите логин и пароль': 'Enter your login and password',
      'Подтвердите согласие на обработку данных': 'Confirm your consent to data processing',
      'Не удалось войти': 'Sign-in failed',
      'Профиль создан': 'Profile created',
      'Вы вошли в аккаунт': 'You are signed in',
      'Сервис настраивается': 'Service update',
      'Мы улучшаем приложение и будем благодарны за обратную связь в личном кабинете.':
        'We are improving the app and would appreciate your feedback in your account.',
      'Информация об оплате': 'Payment information',
      'Баланс обновлён': 'Balance updated',
      'Оплата получена. Чек от самозанятого будет отправлен администратором после проверки.':
        'Payment received. A self-employed receipt will be sent by the administrator after verification.',
      Уведомления: 'Notifications',
      Поддержка: 'Support',
      'Гостевой профиль сохранён': 'Guest profile saved',
      'Выбранное фото': 'Selected photo',
      'Имя или анонимно': 'Name or anonymous',
      '@username, email или телефон': '@username, email, or phone',
      'Что произошло? Что нажали? Что ожидали увидеть?':
        'What happened? What did you select? What did you expect?',
      'Если результат не подошёл, перейдите в личный кабинет и напишите в поддержку — мы поможем.':
        'If the result does not meet your expectations, contact support from your account and we will help.',
      'Замена Головы': 'Face Swap',
      'Кибер Видео [🚧 В разработке]': 'Cyber Video [🚧 In development]',
      'Оживление LTX2.3': 'LTX 2.3 Animation',
      Атлантида: 'Atlantis',
      Барби: 'Barbie',
      Баблгам: 'Bubblegum',
      Бизнес: 'Business',
      Рождество: 'Christmas',
      Комикс: 'Comic',
      'Новых уведомлений нет.': 'No new notifications.',
      'Личный аккаунт': 'Personal account',
      'Локальный профиль': 'Local profile',
      'Создать аккаунт': 'Create account',
      'История, чеки и настройки закреплены за вашим логином.':
        'Your history, receipts, and settings are tied to your login.',
      'Создайте аккаунт по логину и паролю, чтобы восстановить историю на другом устройстве.':
        'Create a login and password account to restore history on another device.',
      'Войти или создать аккаунт': 'Sign in or create account',
      'Контакт для связи': 'Contact details',
      'Оплата подтверждается поддержкой. После оплаты кредиты начисляются вручную, а чек появляется в этом кабинете.':
        'Payment is confirmed by support. Credits are added manually and the receipt appears in this account.',
    },
    vi: {
      'Сменить тему:': 'Chủ đề:',
      'Настройки отображения': 'Cài đặt hiển thị',
      Тема: 'Chủ đề',
      Язык: 'Ngôn ngữ',
      Валюта: 'Tiền tệ',
      Светлая: 'Sáng',
      Тёмная: 'Tối',
      Ретро: 'Cổ điển',
      'Язык:': 'Ngôn ngữ:',
      Главная: 'Trang chủ',
      'Личный кабинет': 'Tài khoản',
      Админ: 'Quản trị',
      Баланс: 'Số dư',
      кредитов: 'tín dụng',
      'Выберите участника, стиль обработки и загрузите фото. Приложение покажет только стили, доступные для текущего режима.':
        'Chọn người tham gia, phong cách xử lý và tải ảnh lên. Ứng dụng chỉ hiển thị các phong cách phù hợp với chế độ hiện tại.',
      'Пополнить баланс': 'Nạp tín dụng',
      'Обновить баланс': 'Cập nhật số dư',
      'Авторизация и бонусы': 'Đăng nhập và ưu đãi',
      Доступно: 'Khả dụng',
      'Стоимость генерации': 'Chi phí tạo ảnh',
      'Хватит примерно': 'Khoảng',
      генераций: 'lần tạo',
      'Пакеты кредитов': 'Gói tín dụng',
      'Запросить токены': 'Yêu cầu tín dụng',
      'Мои сгенерированные фото': 'Ảnh đã tạo của tôi',
      'История пока пустая.': 'Lịch sử đang trống.',
      Выбрать: 'Chọn',
      'Выбрать все': 'Chọn tất cả',
      'Отменить выбор': 'Hủy chọn',
      Скачать: 'Tải xuống',
      Удалить: 'Xóa',
      Выбрано: 'Đã chọn',
      'Контакты и аренда по Краснодарскому краю.': 'Liên hệ và dịch vụ tại vùng Krasnodar.',
      'Обратная связь': 'Phản hồi',
      Отправить: 'Gửi',
      'Админ-консоль': 'Bảng quản trị',
      Войти: 'Đăng nhập',
      'Вход в админ-консоль': 'Đăng nhập quản trị',
      'PIN администратора': 'Mã PIN quản trị',
      'Введите PIN администратора': 'Nhập mã PIN quản trị',
      'Введите PIN администратора. Личный кабинет и баланс этот PIN не запрашивают.':
        'Nhập mã PIN quản trị. Tài khoản và số dư của bạn không bao giờ yêu cầu mã PIN này.',
      'Удалить выбранные': 'Xóa mục đã chọn',
      Design: 'Thiết kế',
      Результат: 'Kết quả',
      'Скачать изображение': 'Tải ảnh',
      Поделиться: 'Chia sẻ',
      'Создать ещё одно': 'Tạo ảnh khác',
      'Личный кабинет FOT AI': 'Tài khoản FOT AI',
      Обновить: 'Cập nhật',
      Старт: 'Khởi đầu',
      Комфорт: 'Thoải mái',
      Популярный: 'Phổ biến',
      Максимум: 'Tối đa',
      Сайт: 'Trang web',
      'Опишите ошибку или идею улучшения.': 'Mô tả lỗi hoặc ý tưởng cải tiến.',
      'Тип обращения': 'Loại yêu cầu',
      Отзыв: 'Phản hồi',
      Ошибка: 'Lỗi',
      'Идея улучшения': 'Ý tưởng cải tiến',
      Имя: 'Tên',
      'Telegram для связи': 'Telegram liên hệ',
      Сообщение: 'Tin nhắn',
      Скриншот: 'Ảnh chụp màn hình',
      Пользователи: 'Người dùng',
      Сохранить: 'Lưu',
      'Чек самозанятого': 'Biên lai tự doanh',
      'Критические ошибки': 'Lỗi nghiêm trọng',
      'Критичных ошибок нет.': 'Không có lỗi nghiêm trọng.',
      'Активные генерации': 'Đang tạo ảnh',
      'Активных генераций сейчас нет.': 'Hiện không có tác vụ tạo ảnh.',
      'Сообщений пока нет.': 'Chưa có tin nhắn.',
      'Фото пользователей: до / после': 'Ảnh người dùng: trước / sau',
      'Сменить аккаунт': 'Đổi tài khoản',
      'Фото пока нет.': 'Chưa có ảnh.',
      'Аудит по сессиям': 'Nhật ký phiên',
      Выйти: 'Đăng xuất',
      'Отметить всё прочитанным': 'Đánh dấu tất cả đã đọc',
      'Скачать аудит': 'Tải nhật ký',
      'Поделиться выбранными': 'Chia sẻ mục đã chọn',
      'Поделиться фото': 'Chia sẻ ảnh',
      'Валюта:': 'Tiền tệ:',
      Версия: 'Phiên bản',
      'Кредиты для AI-генераций': 'Tín dụng cho tạo ảnh AI',
      'Гостевой режим': 'Chế độ khách',
      'Пробный баланс доступен для тестирования. Для сохранения истории откройте приложение через Telegram.':
        'Tín dụng thử nghiệm dùng để trải nghiệm. Mở ứng dụng qua Telegram để lưu lịch sử.',
      'Как авторизоваться?': 'Cách đăng nhập?',
      'Telegram привязан': 'Đã liên kết Telegram',
      'Баланс и генерации сохраняются в личном кабинете.': 'Số dư và ảnh tạo được lưu trong tài khoản.',
      Участник: 'Người tham gia',
      'Тестовое мероприятие FOT AI': 'Sự kiện thử nghiệm FOT AI',
      Мужчина: 'Nam',
      Женщина: 'Nữ',
      Пара: 'Cặp đôi',
      Мальчик: 'Bé trai',
      Девочка: 'Bé gái',
      Семья: 'Gia đình',
      'Стиль обработки': 'Phong cách xử lý',
      'Выберите стиль для генерации': 'Chọn phong cách tạo ảnh',
      Фото: 'Ảnh',
      'Выбрать фото': 'Chọn ảnh',
      'Лучше загрузить портретное фото, где хорошо видно лицо':
        'Ảnh chân dung thấy rõ khuôn mặt sẽ cho kết quả tốt nhất.',
      'Создать AI-фото': 'Tạo ảnh AI',
      'Выберите стиль обработки': 'Chọn phong cách xử lý',
      'На экране': 'Trên màn hình',
      'Стили не найдены. Измените фильтр или поисковый запрос.':
        'Không tìm thấy phong cách. Hãy đổi bộ lọc hoặc tìm kiếm.',
      'Гостевой профиль': 'Hồ sơ khách',
      'Выберите аватар и градиент — настройки сохранятся для этого устройства.':
        'Chọn ảnh đại diện và màu nền — cài đặt được lưu trên thiết bị này.',
      'Чеки об оплате': 'Biên lai thanh toán',
      'Все прикреплённые чеки доступны только этому аккаунту.':
        'Mọi biên lai đính kèm chỉ dành cho tài khoản này.',
      'Чеки пока не прикреплены.': 'Chưa có biên lai nào được đính kèm.',
      'Локальное имя': 'Tên cục bộ',
      'Только для админки': 'Chỉ trong quản trị',
      Переименовать: 'Đổi tên',
      'Приложить чек': 'Đính kèm biên lai',
      'Загрузить админку': 'Mở quản trị',
      'Аудит, обращения, пользователи и генерации.': 'Nhật ký, yêu cầu, người dùng và tác vụ tạo ảnh.',
      Прочитано: 'Đã đọc',
      Стабильность: 'Ổn định',
      Сообщения: 'Tin nhắn',
      Фото: 'Ảnh',
      Активные: 'Đang hoạt động',
      обращений: 'yêu cầu',
      сохранено: 'đã lưu',
      ошибок: 'lỗi',
      генерация: 'lần tạo',
      Все: 'Tất cả',
      'Поиск по стилю или нейросети...': 'Tìm theo phong cách hoặc mô hình...',
      Плитка: 'Lưới',
      Карусель: 'Băng chuyền',
      Лента: 'Băng chuyền',
      'Вид каталога': 'Bố cục danh mục',
      'Плитка или лента: выберите стиль, затем загрузите фото.':
        'Lưới hoặc băng chuyền: chọn phong cách, sau đó tải ảnh lên.',
      'Установка приложения': 'Cài đặt ứng dụng',
      'JPG, JPEG или PNG до 10 МБ': 'JPG, JPEG hoặc PNG tối đa 10 MB',
      'Добавьте FOT AI на экран': 'Thêm FOT AI vào màn hình chính',
      'В браузере: «Поделиться» → «На экран Домой» или «Установить приложение».':
        'Trong trình duyệt: Chia sẻ → Thêm vào Màn hình chính hoặc Cài đặt ứng dụng.',
      'Добро пожаловать в FOT AI': 'Chào mừng đến với FOT AI',
      'Выберите, как начать. Гостевой режим подходит для знакомства, а аккаунт по логину сохраняет историю и чеки для восстановления на другом устройстве.':
        'Chọn cách bắt đầu. Chế độ khách phù hợp để trải nghiệm, còn tài khoản đăng nhập sẽ lưu lịch sử và biên lai để khôi phục trên thiết bị khác.',
      'Продолжить как гость': 'Tiếp tục với tư cách khách',
      'Войти по логину': 'Đăng nhập bằng tài khoản',
      'Выберите аватар гостя и фон прямо сейчас:': 'Chọn ảnh đại diện và nền cho khách ngay bây giờ:',
      'Так будет выглядеть ваш профиль': 'Hồ sơ của bạn sẽ hiển thị như thế này',
      lime: 'Xanh chanh',
      violet: 'Tím',
      sunset: 'Hoàng hôn',
      ocean: 'Đại dương',
      'Открыть через Telegram': 'Mở trong Telegram',
      Понятно: 'Đã hiểu',
      'Вход на этом устройстве': 'Đăng nhập trên thiết bị này',
      'Для первого входа создайте личный профиль. Он хранит только данные, созданные вами в FOT AI.':
        'Trong lần đăng nhập đầu tiên, hãy tạo hồ sơ cá nhân. Hồ sơ chỉ lưu dữ liệu do bạn tạo trong FOT AI.',
      Логин: 'Tên đăng nhập',
      Пароль: 'Mật khẩu',
      'например, natalia': 'ví dụ: natalia',
      'не менее 10 символов': 'ít nhất 10 ký tự',
      'Я согласен(на) на обработку моих данных для работы FOT AI. Фото, генерации, чеки и история удаляются через 14 дней; данные собираются только после самостоятельной регистрации.':
        'Tôi đồng ý cho FOT AI xử lý dữ liệu của mình. Ảnh, ảnh đã tạo, biên lai và lịch sử sẽ bị xóa sau 14 ngày; dữ liệu chỉ được thu thập sau khi tôi tự nguyện đăng ký.',
      'Создать профиль': 'Tạo hồ sơ',
      Закрыть: 'Đóng',
      'Введите логин и пароль': 'Nhập tên đăng nhập và mật khẩu',
      'Подтвердите согласие на обработку данных': 'Xác nhận đồng ý xử lý dữ liệu',
      'Не удалось войти': 'Không thể đăng nhập',
      'Профиль создан': 'Đã tạo hồ sơ',
      'Вы вошли в аккаунт': 'Bạn đã đăng nhập',
      'Сервис настраивается': 'Đang cập nhật dịch vụ',
      'Мы улучшаем приложение и будем благодарны за обратную связь в личном кабинете.':
        'Chúng tôi đang cải thiện ứng dụng và mong nhận được phản hồi trong tài khoản của bạn.',
      'Информация об оплате': 'Thông tin thanh toán',
      'Баланс обновлён': 'Đã cập nhật số dư',
      'Оплата получена. Чек от самозанятого будет отправлен администратором после проверки.':
        'Đã nhận thanh toán. Quản trị viên sẽ gửi biên lai tự doanh sau khi xác minh.',
      Уведомления: 'Thông báo',
      Поддержка: 'Hỗ trợ',
      'Гостевой профиль сохранён': 'Đã lưu hồ sơ khách',
      'Выбранное фото': 'Ảnh đã chọn',
      'Имя или анонимно': 'Tên hoặc ẩn danh',
      '@username, email или телефон': '@username, email hoặc điện thoại',
      'Что произошло? Что нажали? Что ожидали увидеть?':
        'Điều gì đã xảy ra? Bạn đã chọn gì? Bạn mong đợi điều gì?',
      'Если результат не подошёл, перейдите в личный кабинет и напишите в поддержку — мы поможем.':
        'Nếu kết quả chưa phù hợp, hãy liên hệ hỗ trợ từ tài khoản của bạn.',
      'Замена Головы': 'Hoán đổi khuôn mặt',
      'Кибер Видео [🚧 В разработке]': 'Video Cyber [🚧 Đang phát triển]',
      'Оживление LTX2.3': 'Hoạt ảnh LTX 2.3',
      Атлантида: 'Atlantis',
      Барби: 'Barbie',
      Баблгам: 'Kẹo cao su',
      Бизнес: 'Doanh nhân',
      Рождество: 'Giáng sinh',
      Комикс: 'Truyện tranh',
      'Новых уведомлений нет.': 'Không có thông báo mới.',
      'Личный аккаунт': 'Tài khoản cá nhân',
      'Локальный профиль': 'Hồ sơ cục bộ',
      'Создать аккаунт': 'Tạo tài khoản',
      'История, чеки и настройки закреплены за вашим логином.':
        'Lịch sử, biên lai và cài đặt được gắn với tài khoản của bạn.',
      'Создайте аккаунт по логину и паролю, чтобы восстановить историю на другом устройстве.':
        'Tạo tài khoản bằng tên đăng nhập và mật khẩu để khôi phục lịch sử trên thiết bị khác.',
      'Войти или создать аккаунт': 'Đăng nhập hoặc tạo tài khoản',
      'Контакт для связи': 'Thông tin liên hệ',
      'Оплата подтверждается поддержкой. После оплаты кредиты начисляются вручную, а чек появляется в этом кабинете.':
        'Thanh toán được hỗ trợ xác nhận. Tín dụng được cộng thủ công và biên lai xuất hiện trong tài khoản này.',
    },
  };

  const CREDIT_PACKAGES = [
    { key: 'start', name: 'Старт', credits: 50, RUB: 49, USD: 0.59, VND: 15000 },
    { key: 'comfort', name: 'Комфорт', credits: 120, RUB: 99, USD: 1.19, VND: 30000 },
    { key: 'popular', name: 'Популярный', credits: 300, RUB: 249, USD: 2.99, VND: 75000 },
    { key: 'maximum', name: 'Максимум', credits: 700, RUB: 499, USD: 5.99, VND: 150000 },
  ];

  function formatMoney(value, currency = state.currency) {
    const locale = state.language === 'vi' ? 'vi-VN' : state.language === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'VND' ? 0 : 2,
    }).format(Number(value || 0));
  }

  function translatedText(source) {
    if (state.language === 'ru') return source;
    return TRANSLATIONS[state.language]?.[source] || source;
  }

  function selectedStyleMarkup(style) {
    if (!style) return translatedText('Выберите стиль обработки');

    const label =
      state.language === 'vi'
        ? 'Phong cách đã chọn:'
        : state.language === 'en'
          ? 'Selected style:'
          : 'Выбран стиль:';

    return `${label} <b>${esc(translatedText(style.title))}</b> · ${esc(style.provider)}`;
  }

  function applyLanguage(node) {
    document.documentElement.lang = state.language;
    if (state.language === 'ru') return;

    const dictionary = TRANSLATIONS[state.language] || {};
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach((textNode) => {
      if (['SCRIPT', 'STYLE'].includes(textNode.parentElement?.tagName)) return;
      const source = String(textNode.nodeValue || '').trim();
      if (!source) return;

      let translated = dictionary[source];
      if (!translated) {
        const selectedMatch = source.match(/^Удалить выбранные \((\d+)\)$/);
        if (selectedMatch) translated = `${dictionary['Удалить выбранные']} (${selectedMatch[1]})`;
        const shareMatch = source.match(/^Поделиться выбранными \((\d+)\)$/);
        if (shareMatch) translated = `${dictionary['Поделиться выбранными']} (${shareMatch[1]})`;
        const notificationMatch = source.match(/^Уведомления: (\d+) новых$/);
        if (notificationMatch)
          translated =
            state.language === 'vi'
              ? `Thông báo: ${notificationMatch[1]} mới`
              : `Notifications: ${notificationMatch[1]} new`;
        const versionMatch = source.match(/^Версия\s+(.+)$/);
        if (versionMatch) translated = `${dictionary['Версия'] || 'Version'} ${versionMatch[1]}`;
        const paginationMatch = source.match(/^(\d+)-(\d+) из (\d+)$/);
        if (paginationMatch)
          translated =
            state.language === 'vi'
              ? `${paginationMatch[1]}-${paginationMatch[2]} trên ${paginationMatch[3]}`
              : `${paginationMatch[1]}-${paginationMatch[2]} of ${paginationMatch[3]}`;
        const creditsMatch = source.match(/^(\d+) кредитов$/);
        if (creditsMatch)
          translated = state.language === 'vi' ? `${creditsMatch[1]} tín dụng` : `${creditsMatch[1]} credits`;
        const selectedStyleMatch = source.match(/^Выбран стиль: (.+) · (.+)$/);
        if (selectedStyleMatch) {
          const styleTitle = dictionary[selectedStyleMatch[1]] || selectedStyleMatch[1];
          translated =
            state.language === 'vi'
              ? `Phong cách đã chọn: ${styleTitle} · ${selectedStyleMatch[2]}`
              : `Selected style: ${styleTitle} · ${selectedStyleMatch[2]}`;
        }
      }

      if (translated) textNode.nodeValue = textNode.nodeValue.replace(source, translated);
    });

    qsa('[placeholder]', node).forEach((element) => {
      const translated = dictionary[element.placeholder];
      if (translated) element.placeholder = translated;
    });

    qsa('[title], [aria-label], [alt]', node).forEach((element) => {
      ['title', 'aria-label', 'alt'].forEach((attribute) => {
        const source = element.getAttribute(attribute);
        const translated = dictionary[source];
        if (translated) element.setAttribute(attribute, translated);
      });
    });
  }

  function getUser() {
    const storageKey = 'fot-ai-browser-user-v1';
    let id = localStorage.getItem(storageKey);
    if (!id) {
      id = `web_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
      localStorage.setItem(storageKey, id);
    }
    const agent = navigator.userAgent || '';
    const platform = /Windows NT 10|Windows NT 11/i.test(agent)
      ? 'Windows 10+'
      : /Macintosh|Mac OS X/i.test(agent)
        ? 'macOS'
        : /Android/i.test(agent)
          ? 'Android'
          : /iPhone|iPad/i.test(agent)
            ? 'iOS'
            : 'other';
    const browser = /Edg\//i.test(agent)
      ? 'Edge'
      : /Chrome\//i.test(agent)
        ? 'Chrome'
        : /Safari\//i.test(agent)
          ? 'Safari'
          : /Firefox\//i.test(agent)
            ? 'Firefox'
            : 'browser';
    let trafficSource = 'direct';
    try {
      trafficSource = document.referrer ? new URL(document.referrer).hostname : 'direct';
    } catch (_) {}
    return {
      id,
      username: `web-${id.slice(-6)}`,
      name: 'Browser user',
      authProvider: 'web',
      deviceName: `${platform} · ${browser} · ${/Mobile/i.test(agent) ? 'mobile' : 'desktop'}`,
      trafficSource,
    };
  }

  function root() {
    let node =
      document.getElementById('app') ||
      document.getElementById('root') ||
      document.querySelector('[data-app]');

    if (!node) {
      document.body.innerHTML = '';
      node = document.createElement('main');
      node.id = 'app';
      document.body.appendChild(node);
    }

    return node;
  }

  function apiPayload(extra = {}) {
    return {
      ...state.user,
      sessionId: SESSION_ID,
      ...extra,
    };
  }

  async function apiGet(path) {
    const url = new URL(`${API}${path}`, window.location.origin);

    Object.entries(state.user).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });

    if (state.adminPin) url.searchParams.set('pin', state.adminPin);

    const res = await fetch(url.toString(), {
      cache: 'no-store',
      headers: state.authToken ? { 'X-FOT-Session': state.authToken } : {},
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.ok === false) {
      throw new Error(json.message || `HTTP ${res.status}`);
    }

    return json;
  }

  async function apiPost(path, data = {}) {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(state.authToken ? { 'X-FOT-Session': state.authToken } : {}),
      },
      body: JSON.stringify(
        apiPayload({
          ...(state.adminPin ? { pin: state.adminPin } : {}),
          ...data,
        }),
      ),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.ok === false) {
      throw new Error(json.message || `HTTP ${res.status}`);
    }

    return json;
  }

  async function bootstrapIdentity() {
    const response = await fetch(`${API}/identity/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...state.user,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false || !data.profile || !data.sessionToken) {
      throw new Error(data.message || 'Identity session could not be created');
    }

    state.user = { ...state.user, ...data.profile };
    state.authToken = data.sessionToken;
    sessionStorage.setItem('fot-ai-identity-session-v1', data.sessionToken);
  }

  function changeAccount() {
    // Sessions are kept only in this browser tab. The profile itself remains
    // in the account store; changing account never deletes history or credits.
    sessionStorage.removeItem('fot-ai-identity-session-v1');
    localStorage.removeItem('fot-ai-browser-user-v1');
    localStorage.setItem('fot-ai-force-browser-v1', '1');
    localStorage.removeItem('fot-ai-welcome-v1');
    window.location.reload();
  }

  async function audit(title, details = {}, level = 'info', type = 'event') {
    const payload = apiPayload({
      title,
      details,
      level,
      type,
      page: state.page,
      theme: state.theme,
      createdAt: new Date().toISOString(),
    });

    console[level === 'error' ? 'error' : 'log']('[FOT AI audit]', title, payload);

    try {
      await fetch(`${API}/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(state.authToken ? { 'X-FOT-Session': state.authToken } : {}),
        },
        body: JSON.stringify(payload),
      });
    } catch (_) {}
  }

  function toast(text, type = 'ok') {
    state.message = { text: translatedText(text), type };
    renderToast();

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      state.message = null;
      renderToast();
    }, 2400);
  }

  function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem('fototime-theme-v14', theme);
    document.documentElement.dataset.ftTheme = theme;
    document.body.dataset.ftTheme = theme;

    if (theme !== 'design') {
      document.documentElement.style.removeProperty('--ft-design-x');
      document.documentElement.style.removeProperty('--ft-design-y');
    }
  }

  function handleDesignPointer(event) {
    if (state.theme !== 'design' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const x = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 26;
    const y = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 18;
    document.documentElement.style.setProperty('--ft-design-x', `${x.toFixed(1)}px`);
    document.documentElement.style.setProperty('--ft-design-y', `${y.toFixed(1)}px`);
  }

  function syncFromServer(data) {
    if (data.version) state.version = String(data.version);
    if (data.user) state.user = data.user;
    if (typeof data.balance === 'number') state.balance = data.balance;
    if (typeof data.cost === 'number') state.cost = data.cost;
    if (Array.isArray(data.styles)) state.styles = data.styles;
    if (Array.isArray(data.generations)) state.generations = data.generations;
    if (Array.isArray(data.notifications)) state.notifications = data.notifications;
  }

  async function loadStyles() {
    try {
      const payload = await apiGet('/styles');
      const styles = Array.isArray(payload?.styles)
        ? payload.styles
        : Array.isArray(payload?.items)
          ? payload.items
          : [];

      if (styles.length) {
        state.styles = styles;
        state.pageIndex = 0;
      }

      await audit('Каталог стилей загружен', {
        styles: styles.length,
        source: 'api/fototime/styles',
      });
    } catch (error) {
      console.error('[FOT AI] style catalog request failed', error);
      await audit(
        'Ошибка загрузки каталога стилей',
        { message: error.message },
        'error',
        'styles_force_error',
      );
    }
  }

  async function loadState() {
    try {
      const data = await apiGet('/state');
      syncFromServer(data);
      if (!state.styles.length) await loadStyles();

      await audit('Состояние приложения загружено', {
        balance: state.balance,
        styles: state.styles.length,
      });
    } catch (error) {
      console.error('[FOT AI] state request failed', error);

      await audit('Ошибка загрузки состояния', { message: error.message }, 'error', 'state_error');

      state.styles = fallbackStyles();
      await loadStyles();
    }
  }

  function fallbackStyles() {
    return [
      ['1001', 'Атлантида', 'SDXL'],
      ['1002', 'Барби', 'SDXL'],
      ['1003', 'Баблгам', 'SDXL'],
      ['1004', 'Бизнес', 'SDXL'],
      ['2001', 'Поле боя', 'FLUX.2'],
      ['2002', 'Кибернетика', 'FLUX.2'],
      ['2003', 'Алхимик', 'FLUX.2'],
      ['3001', 'White rabbits', 'Nano Banana'],
      ['3002', 'Diamonds', 'Nano Banana'],
      ['3003', 'Luxor', 'Nano Banana'],
    ].map(([id, title, provider]) => ({ id, title, provider, preview: '' }));
  }

  function providers() {
    const values = [...new Set(state.styles.map((s) => s.provider).filter(Boolean))];
    return ['Все', ...values];
  }

  function filteredStyles() {
    const query = norm(state.search);

    return state.styles.filter((style) => {
      const providerOk = state.styleFilter === 'Все' || style.provider === state.styleFilter;
      const searchOk = !query || norm(`${style.title} ${style.provider}`).includes(query);

      return providerOk && searchOk;
    });
  }

  function pageStyles() {
    const list = filteredStyles();

    const gridPer = [6, 9, 12].includes(Number(state.perPage)) ? Number(state.perPage) : 6;

    const per = state.view === 'carousel' ? 3 : gridPer;
    const maxPage = Math.max(0, Math.ceil(list.length / per) - 1);

    if (state.pageIndex > maxPage) state.pageIndex = maxPage;
    if (state.pageIndex < 0) state.pageIndex = 0;

    const start = state.pageIndex * per;
    const end = Math.min(start + per, list.length);

    return {
      list,
      items: list.slice(start, end),
      start,
      end,
      per,
      maxPage,
    };
  }

  function initials(title) {
    return String(title || 'AI')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  function styleImage(style) {
    if (!style.preview) return '';

    return `
      <img
        src="${esc(style.preview)}"
        alt="${esc(style.title)}"
        loading="lazy"
        onerror="this.closest('.ft-style-media')?.classList.add('is-empty'); this.remove();"
      >
    `;
  }

  function isSelected(style) {
    return state.selectedStyle && String(state.selectedStyle.id) === String(style.id);
  }

  function render() {
    setTheme(state.theme);

    root().innerHTML = `
      <div class="ft-app">
        ${topBar()}
        ${header()}
        <section id="ft-page">${pageContent()}</section>
        <footer class="ft-footer">FOT AI · <a href="https://github.com/natalia-lebedinskaya/fototime-ai-mini-app" target="_blank" rel="noreferrer">GitHub</a></footer>
        ${bottomNav()}
        ${state.installHintVisible ? installHint() : ''}
        <div id="ft-toast"></div>
        <div id="ft-progress"></div>
      </div>
    `;

    renderToast();
    renderProgress();
    applyLanguage(root());
  }

  function installHint() {
    return `
      <aside class="ft-install-hint" role="dialog" aria-label="Установка приложения">
        <button class="ft-install-close" data-action="install-dismiss" type="button" aria-label="Закрыть">×</button>
        <span class="ft-install-mark" aria-hidden="true">F</span>
        <div><b>Добавьте FOT AI на экран</b><small>В браузере: «Поделиться» → «На экран Домой» или «Установить приложение».</small></div>
      </aside>
    `;
  }

  function topBar() {
    const unread = state.notifications.filter((n) => n.unread).length;

    return `
      <div class="ft-topbar ft-topbar-v2">
        <button class="ft-balance-pill ft-balance-pill-v2" data-action="refresh-balance" type="button" title="Обновить баланс">
          <span class="ft-token-icon ft-token-icon-v2 ft-topbar-brand" aria-hidden="true">
            <i>F</i><em>FOT AI</em>
          </span>

          <span class="ft-balance-copy">
            <span class="ft-balance-label">Баланс</span>
            <span class="ft-balance-value"><b>${state.balance}</b> <span>кредитов</span></span>
          </span>

          <span class="ft-refresh-icon ft-refresh-icon-v2" aria-hidden="true">↻</span>
        </button>

        <button class="ft-bell-pill" data-action="show-notifications" type="button" title="Уведомления" aria-label="Уведомления">
          <span class="ft-bell-icon" aria-hidden="true">🔔</span>
          ${unread ? `<span class="ft-bell-count">${unread}</span>` : ``}
        </button>

      </div>
    `;
  }

  function header() {
    return `
      <header class="ft-hero">
        <div class="ft-hero-row">
          <span class="ft-brand">FOT AI</span>
        </div>

        <div class="ft-preferences" aria-label="Настройки отображения">
          <label class="ft-theme-label">
            <span>Тема</span>
            <select data-action="theme-select">
              <option value="light" ${state.theme === 'light' ? 'selected' : ''}>Светлая</option>
              <option value="dark" ${state.theme === 'dark' ? 'selected' : ''}>Тёмная</option>
              <option value="retro" ${state.theme === 'retro' ? 'selected' : ''}>Ретро</option>
              <option value="design" ${state.theme === 'design' ? 'selected' : ''}>Design</option>
            </select>
          </label>

          <label class="ft-theme-label">
            <span>Язык</span>
            <select data-action="language-select">
              <option value="ru" ${state.language === 'ru' ? 'selected' : ''}>RU</option>
              <option value="en" ${state.language === 'en' ? 'selected' : ''}>EN</option>
              <option value="vi" ${state.language === 'vi' ? 'selected' : ''}>VI</option>
            </select>
          </label>

          <label class="ft-theme-label">
            <span>Валюта</span>
            <select data-action="currency-select">
              <option value="RUB" ${state.currency === 'RUB' ? 'selected' : ''}>RUB ₽</option>
              <option value="USD" ${state.currency === 'USD' ? 'selected' : ''}>USD $</option>
              <option value="VND" ${state.currency === 'VND' ? 'selected' : ''}>VND ₫</option>
            </select>
          </label>
        </div>

        <h1>FOT AI</h1>
        <p>Выберите участника, стиль обработки и загрузите фото. Приложение покажет только стили, доступные для текущего режима.</p>
        <small class="ft-header-version">Версия ${esc(state.version)}</small>
      </header>
    `;
  }

  function pageContent() {
    if (state.page === 'profile') return profilePage();
    if (state.page === 'admin') return adminPage();
    return homePage();
  }

  function cardHeader(code, title, subtitle, media = '') {
    const icon =
      { FT: '✦', ME: '☺', LK: '◌', RC: '▣', FB: '✎', AD: '⌘', '01': '◉', '02': '◈', '03': '▧', '04': '✓' }[
        code
      ] || '✦';
    return `
      <div class="ft-section-head">
        ${media || `<span class="ft-step" aria-hidden="true">${icon}</span>`}
        <div>
          <h2>${title}</h2>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
      </div>
    `;
  }

  function balanceCard() {
    const count = Math.floor(state.balance / state.cost);

    return `
      <section class="ft-card ft-balance-card">
        ${cardHeader('FT', 'Баланс', 'Кредиты для AI-генераций')}

        <div class="ft-balance-grid">
          <div class="ft-metric is-accent">
            <span>Доступно</span>
            <b>${state.balance}</b>
            <small>кредитов</small>
          </div>

          <div class="ft-metric">
            <span>Стоимость генерации</span>
            <b>${state.cost}</b>
            <small>кредитов</small>
          </div>

          <div class="ft-metric">
            <span>Хватит примерно</span>
            <b>${count}</b>
            <small>${count === 1 ? 'генерация' : 'генераций'}</small>
          </div>
        </div>

        <div class="ft-actions-row">
          <button type="button" class="ft-btn ft-primary" data-action="go-profile">Пополнить баланс</button>
          <button type="button" class="ft-btn" data-action="refresh-balance">Обновить баланс</button>
          <button type="button" class="ft-btn" data-action="bonus-help">Авторизация и бонусы</button>
        </div>
      </section>
    `;
  }

  function homePage() {
    const hasAccount = state.user?.authProvider === 'password';
    return `
      ${balanceCard()}

      <section class="ft-info-row">
        <span class="ft-step">LO</span>
        <div>
          <b>${hasAccount ? 'Личный аккаунт' : 'Локальный профиль'}</b>
          <p>${hasAccount ? 'История, чеки и настройки закреплены за вашим логином.' : 'Создайте аккаунт по логину и паролю, чтобы восстановить историю на другом устройстве.'}</p>
        </div>
        <button class="ft-btn" data-action="auth-help">${hasAccount ? 'Личный кабинет' : 'Создать аккаунт'}</button>
      </section>

      <section class="ft-card">
        ${cardHeader('01', 'Участник', 'Тестовое мероприятие FOT AI')}

        <div class="ft-participants">
          ${['male:Мужчина', 'female:Женщина', 'couple:Пара', 'boy:Мальчик', 'girl:Девочка', 'family:Семья']
            .map((row) => {
              const [id, label] = row.split(':');
              return `
                <button class="ft-choice ${state.participant === id ? 'is-active' : ''}" data-action="participant" data-id="${id}" type="button">
                  ${label}
                </button>
              `;
            })
            .join('')}
        </div>
      </section>

      <section class="ft-card">
        ${cardHeader('02', 'Стиль обработки', 'Выберите стиль для генерации')}
        ${stylesBlock()}
      </section>

      <section class="ft-card" id="ft-photo-block">
        ${cardHeader('03', 'Фото', 'JPG, JPEG или PNG до 10 МБ')}

        <label class="ft-upload">
          <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" data-action="file-input">
          ${state.filePreview ? `<img src="${state.filePreview}" alt="Выбранное фото">` : '<span>Выбрать фото</span>'}
          <strong>${state.file ? esc(state.file.name) : 'Лучше загрузить портретное фото, где хорошо видно лицо'}</strong>
        </label>
        <label class="ft-camera-button">
          <input type="file" accept="image/*" capture="user" data-action="file-input">
          <span aria-hidden="true">◎</span>
          Сделать фото
        </label>

        <button class="ft-generate" data-action="generate" type="button" ${canGenerate() ? '' : 'disabled'}>
          Создать AI-фото
        </button>

        <div class="ft-selected-note">
          ${selectedStyleMarkup(state.selectedStyle)}
        </div>
      </section>

      ${resultBlock()}
    `;
  }

  function stylesBlock() {
    const page = pageStyles();

    return `
      <div class="ft-filter-box">
        <div class="ft-search-row">
          <span class="ft-search-icon" aria-hidden="true">⌕</span>
          <input
            id="ft-style-search"
            data-action="search"
            type="search"
            autocomplete="off"
            placeholder="Поиск по стилю или нейросети..."
            value="${esc(state.search)}"
          >
        </div>

        <div class="ft-provider-row">
          ${providers()
            .map(
              (provider) => `
              <button class="ft-chip ${state.styleFilter === provider ? 'is-active' : ''}" data-action="provider" data-provider="${esc(provider)}" type="button">
                ${esc(provider)}
              </button>
            `,
            )
            .join('')}
        </div>
      </div>

      <div class="ft-view-row">
        <div class="ft-view-switch" role="group" aria-label="Вид каталога">
          <button class="ft-icon-btn ${state.view === 'grid' ? 'is-active' : ''}" data-action="view" data-view="grid" type="button" title="Плитка" aria-label="Плитка">▦</button>
          <button class="ft-icon-btn ${state.view === 'carousel' ? 'is-active' : ''}" data-action="view" data-view="carousel" type="button" title="Лента" aria-label="Лента">↔</button>
        </div>
        <div class="ft-catalog-hint" role="status">Плитка или лента: выберите стиль, затем загрузите фото.</div>
        <label>
          На экране
          <select data-action="per-page">
            ${[6, 9, 12]
              .map((n) => `<option value="${n}" ${state.perPage === n ? 'selected' : ''}>${n}</option>`)
              .join('')}
          </select>
        </label>
      </div>

      <div id="ft-styles-host">
        ${stylesList(page)}
      </div>
    `;
  }

  function stylesList(page = pageStyles()) {
    if (!page.list.length) {
      return `<div class="ft-empty">Стили не найдены. Измените фильтр или поисковый запрос.</div>`;
    }

    const cls = `ft-style-list ${state.view === 'carousel' ? 'is-carousel' : 'is-grid'}`;

    return `
      <div class="${cls}" data-view="${state.view}">
        ${page.items.map((style) => styleCard(style)).join('')}
      </div>

      <div class="ft-pagination">
        <button class="ft-round" data-action="styles-prev" type="button" ${state.pageIndex <= 0 ? 'disabled' : ''}>←</button>
        <b>${page.start + 1}-${page.end} из ${page.list.length}</b>
        <button class="ft-round is-next" data-action="styles-next" type="button" ${state.pageIndex >= page.maxPage ? 'disabled' : ''}>→</button>
      </div>
    `;
  }

  function styleCard(style) {
    const title = translatedText(style.title);
    return `
      <button class="ft-style-card ${isSelected(style) ? 'is-selected' : ''}" data-action="style" data-style-id="${esc(style.id)}" type="button">
        <span class="ft-style-media ${style.preview ? '' : 'is-empty'}">
          ${styleImage(style)}
          <i>${esc(initials(title))}</i>
        </span>
        <span class="ft-style-title">${esc(title)}</span>
        <span class="ft-style-provider">${esc(style.provider)}</span>
      </button>
    `;
  }

  function canGenerate() {
    return Boolean(
      state.participant && state.selectedStyle && state.file && !state.busy && state.balance >= state.cost,
    );
  }

  function resultBlock() {
    const last = state.currentResult;

    if (!last?.resultUrl) return '';

    return `
      <section class="ft-card ft-result">
        ${cardHeader('04', 'Результат', `${esc(last.styleTitle || 'AI photo')} · ${esc(last.provider || '')}`)}

        <img src="${esc(last.resultUrl)}" alt="AI photo result">

        <div class="ft-actions-row">
          <button class="ft-btn ft-primary" data-action="download-result" data-url="${esc(last.resultUrl)}" type="button">Скачать изображение</button>
          <button class="ft-btn" data-action="share-result" data-url="${esc(last.resultUrl)}" type="button">Поделиться</button>
          <button class="ft-btn" data-action="create-more" type="button">Создать ещё одно</button>
        </div>

        <p class="ft-help-text">Если результат не подошёл, перейдите в личный кабинет и напишите в поддержку — мы поможем.</p>
      </section>
    `;
  }

  function profilePage() {
    const count = Math.floor(state.balance / state.cost);
    const notesUnread = state.notifications.filter((n) => n.unread).length;

    return `
      ${
        state.user?.authProvider !== 'password'
          ? `
      <section class="ft-card ft-guest-profile-card">
        ${cardHeader('ME', 'Гостевой профиль', 'Выберите аватар и градиент — настройки сохранятся для этого устройства.')}
        <div class="ft-avatar-picker">
          <div class="ft-avatar-preview gradient-${esc(state.user.avatarGradient || 'lime')}">${esc(state.user.avatarEmoji || '✨')}</div>
          <div class="ft-avatar-options">
            <div>${['✨', '🌿', '🪩', '🌙', '🎨', '🫧'].map((emoji) => `<button class="ft-mini ${state.user.avatarEmoji === emoji ? 'is-active' : ''}" data-action="avatar-emoji" data-emoji="${emoji}" type="button">${emoji}</button>`).join('')}</div>
            <div>${['lime', 'violet', 'sunset', 'ocean'].map((gradient) => `<button class="ft-mini ${state.user.avatarGradient === gradient ? 'is-active' : ''}" data-action="avatar-gradient" data-gradient="${gradient}" type="button">${gradient}</button>`).join('')}</div>
          </div>
        </div>
      </section>`
          : ''
      }
      <section class="ft-card">
        ${cardHeader('LK', `@${esc(state.user.username || state.user.name)}`, 'Личный кабинет FOT AI', state.user.photoUrl ? `<img class="ft-profile-avatar" src="${esc(state.user.photoUrl)}" alt="Фото профиля">` : '')}

        <div class="ft-balance-grid">
          <div class="ft-metric">
            <span>Доступно</span>
            <b>${state.balance}</b>
            <small>кредитов</small>
            <button class="ft-mini" data-action="refresh-balance" type="button">Обновить</button>
          </div>

          <div class="ft-metric">
            <span>Стоимость генерации</span>
            <b>${state.cost}</b>
            <small>кредитов</small>
          </div>

          <div class="ft-metric">
            <span>Хватит примерно</span>
            <b>${count}</b>
            <small>генераций</small>
          </div>
        </div>

        <button class="ft-btn" data-action="show-notifications" type="button">Уведомления: ${notesUnread} новых</button>
        <div class="ft-actions-row ft-account-actions">
          <button class="ft-btn" data-action="account-switch" type="button">Сменить аккаунт</button>
          <button class="ft-btn ft-danger" data-action="sign-out" type="button">Выйти</button>
        </div>
      </section>

      <section class="ft-card ft-receipts-card">
        ${cardHeader('RC', 'Чеки об оплате', 'Все прикреплённые чеки доступны только этому аккаунту.')}
        ${receiptList()}
      </section>

      <section class="ft-card">
        <h2>Пакеты кредитов</h2>
        <p class="ft-muted">Оплата подтверждается поддержкой. После оплаты кредиты начисляются вручную, а чек появляется в этом кабинете.</p>

        <div class="ft-packages">
          ${CREDIT_PACKAGES.map(
            (item) => `
              <button class="ft-package" data-action="token-request" data-package="${esc(item.key)}" data-credits="${item.credits}" data-currency="${state.currency}" data-amount="${item[state.currency]}" type="button">
                <b>${item.name}</b>
                <span>${item.credits} кредитов</span>
                <strong>${formatMoney(item[state.currency])}</strong>
              </button>
            `,
          ).join('')}
        </div>

        <p class="ft-muted">Итоговая сумма и реквизиты подтверждаются до оплаты. После оплаты вы получите чек самозанятого.</p>
      </section>

      <section class="ft-card">
        <div class="ft-history-heading">
          <h2>Мои сгенерированные фото</h2>
          ${
            state.generations.length
              ? `
            <div class="ft-history-toolbar">
              <button class="ft-mini" data-action="history-select-mode" type="button">
                ${state.historySelectMode ? 'Отменить выбор' : 'Выбрать'}
              </button>
              ${
                state.historySelectMode
                  ? `
                <button class="ft-mini" data-action="history-select-all" type="button">Выбрать все</button>
                <button class="ft-mini ft-danger" data-action="history-delete-selected" type="button" ${state.historySelected.length ? '' : 'disabled'}>
                  Удалить выбранные (${state.historySelected.length})
                </button>
                <button class="ft-mini" data-action="history-share-selected" type="button" ${state.historySelected.length ? '' : 'disabled'}>
                  Поделиться выбранными (${state.historySelected.length})
                </button>
              `
                  : ''
              }
            </div>
          `
              : ''
          }
        </div>
        ${
          state.generations.length
            ? `<div class="ft-history-grid">
                ${state.generations
                  .map((g) => {
                    const generationId = String(g.id || g.generationId || '');
                    const isSelected = state.historySelected.includes(generationId);

                    return `
                    <article class="${isSelected ? 'is-selected' : ''}">
                      ${
                        state.historySelectMode
                          ? `
                        <button class="ft-history-select ${isSelected ? 'is-selected' : ''}" data-action="history-select" data-id="${esc(generationId)}" type="button" aria-pressed="${isSelected}">
                          ${isSelected ? '✓ Выбрано' : 'Выбрать'}
                        </button>
                      `
                          : ''
                      }
                      <img src="${esc(g.resultUrl)}" alt="${esc(g.styleTitle)}">
                      <b>${esc(g.styleTitle)}</b>
                      <span>${formatDate(g.createdAt)}</span>
                      <div class="ft-history-actions">
                        <a class="ft-mini" href="${esc(g.resultUrl)}" download>Скачать</a>
                        ${
                          state.historySelectMode
                            ? ''
                            : `
                          <button class="ft-mini" data-action="history-share-one" data-id="${esc(generationId)}" type="button">Поделиться фото</button>
                          <button class="ft-mini ft-danger" data-action="history-delete-one" data-id="${esc(generationId)}" type="button">Удалить</button>
                        `
                        }
                      </div>
                    </article>
                  `;
                  })
                  .join('')}
              </div>`
            : '<p class="ft-muted">История пока пустая.</p>'
        }
      </section>

      ${contactsBlock()}
      ${feedbackBlock()}
    `;
  }

  function receiptList() {
    const receipts = state.notifications.filter((item) => item.receiptUrl);
    if (!receipts.length) return '<p class="ft-muted">Чеки пока не прикреплены.</p>';
    return `<div class="ft-receipt-list">${receipts
      .map((item) => {
        const url = new URL(item.receiptUrl, window.location.origin);
        Object.entries(state.user).forEach(([key, value]) => url.searchParams.set(key, value));
        return `<a class="ft-btn" href="${esc(url.toString())}" download>Скачать чек от ${esc(formatDate(item.createdAt))}</a>`;
      })
      .join('')}</div>`;
  }

  function contactsBlock() {
    const links = [
      ['Поддержка', 'https://t.me/fototime23_Bot'],
      ['VK', 'https://vk.com/fototime323'],
      ['MAX', 'https://max.ru/join/bRIUnVt_oVplSVIoptiXlMaLOUqGk0hUYwx9WUmBY1U'],
      ['Сайт', 'https://fototime323.lpmotortest.com'],
    ];

    return `
      <section class="ft-card">
        ${cardHeader('FT', 'FOT AI', 'Контакты и аренда по Краснодарскому краю.')}

        <div class="ft-social-grid">
          ${links
            .map(
              ([label, url]) => `
              <a class="ft-social" href="${esc(url)}" target="_blank" rel="noreferrer" data-action="social" data-label="${esc(label)}">
                ${label}
                <span>↗</span>
              </a>
            `,
            )
            .join('')}
        </div>
      </section>
    `;
  }

  function feedbackBlock() {
    return `
      <section class="ft-card">
        ${cardHeader('FB', 'Обратная связь', 'Опишите ошибку или идею улучшения.')}

        <form class="ft-feedback" data-action="feedback-form">
          <label>
            Тип обращения
            <select name="kind">
              <option>Отзыв</option>
              <option>Ошибка</option>
              <option>Идея улучшения</option>
            </select>
          </label>

          <label>
            Имя
            <input name="name" placeholder="Имя или анонимно">
          </label>

          <label>
            Контакт для связи
            <input name="contact" placeholder="@username, email или телефон">
          </label>

          <label>
            Сообщение
            <textarea name="message" placeholder="Что произошло? Что нажали? Что ожидали увидеть?"></textarea>
          </label>

          <label>
            Скриншот
            <input name="screenshot" type="file" accept="image/png,image/jpeg,image/jpg,image/webp">
          </label>

          <button class="ft-generate" type="submit">Отправить</button>
        </form>
      </section>
    `;
  }

  function adminPage() {
    const admin = state.admin;

    if (!admin) {
      return `
        <section class="ft-card">
          <h2>Админ-консоль</h2>
          <button class="ft-generate" data-action="load-admin" type="button">Загрузить админку</button>
        </section>
      `;
    }

    return `
      <section class="ft-card">
        ${cardHeader('AD', 'Админ-консоль', 'Аудит, обращения, пользователи и генерации.')}

        <div class="ft-admin-actions">
          <button class="ft-btn ft-primary" data-action="download-audit" type="button">Скачать аудит</button>
          <button class="ft-btn" data-action="admin-read-all" type="button">Прочитано</button>
          <button class="ft-btn ft-danger" data-action="admin-clear-audit" type="button">Очистить аудит</button>
          <button class="ft-btn" data-action="admin-logout" type="button">Выйти</button>
        </div>

        <div class="ft-balance-grid">
          <div class="ft-metric">
            <span>Стабильность</span>
            <b>${admin.stability || 100}%</b>
            <small>${(admin.errors || []).length} ошибок</small>
          </div>

          <div class="ft-metric">
            <span>Сообщения</span>
            <b>${(admin.feedback || []).length}</b>
            <small>обращений</small>
          </div>

          <div class="ft-metric">
            <span>Фото</span>
            <b>${(admin.photos || []).length}</b>
            <small>сохранено</small>
          </div>

          <div class="ft-metric">
            <span>Активные</span>
            <b>${(admin.activeGenerations || []).length}</b>
            <small>генерации</small>
          </div>
        </div>
      </section>

      <section class="ft-card">
        <div class="ft-section-heading"><h2>Пользователи</h2><button class="ft-mini ft-danger" data-action="admin-bulk-clear" data-scope="users">Удалить выбранных</button></div>
        ${(admin.users || []).map(userAdminRow).join('') || '<p class="ft-muted">Пользователей пока нет.</p>'}
      </section>

      <section class="ft-card">
        <div class="ft-section-heading"><h2>Критичные ошибки</h2><button class="ft-mini ft-danger" data-action="admin-bulk-clear" data-scope="audit" data-all="true">Очистить все</button></div>
        ${(admin.errors || []).length ? admin.errors.map(errorRow).join('') : '<p class="ft-muted">Критичных ошибок нет.</p>'}
      </section>

      <section class="ft-card">
        <div class="ft-section-heading"><h2>Активные генерации</h2><button class="ft-mini ft-danger" data-action="admin-bulk-clear" data-scope="active" data-all="true">Очистить все</button></div>
        ${(admin.activeGenerations || []).length ? admin.activeGenerations.map(activeRow).join('') : '<p class="ft-muted">Активных генераций сейчас нет.</p>'}
      </section>

      <section class="ft-card">
        <div class="ft-section-heading"><h2>Обратная связь</h2><button class="ft-mini ft-danger" data-action="admin-bulk-clear" data-scope="feedback" data-all="true">Очистить все</button></div>
        ${(admin.feedback || []).length ? admin.feedback.map(feedbackRow).join('') : '<p class="ft-muted">Сообщений пока нет.</p>'}
      </section>

      <section class="ft-card">
        <div class="ft-section-heading"><h2>Фото пользователей: до / после</h2><button class="ft-mini ft-danger" data-action="admin-bulk-clear" data-scope="generations" data-all="true">Очистить все</button></div>
        ${(admin.photos || []).length ? `<div class="ft-admin-photos">${admin.photos.map(photoRow).join('')}</div>` : '<p class="ft-muted">Фото пока нет.</p>'}
      </section>

      <section class="ft-card">
        <div class="ft-section-heading"><h2>Аудит по сессиям</h2><button class="ft-mini ft-danger" data-action="admin-bulk-clear" data-scope="audit" data-all="true">Очистить все</button></div>
        ${(admin.sessions || []).map(sessionRow).join('') || '<p class="ft-muted">Аудита пока нет.</p>'}
      </section>
    `;
  }

  function userAdminRow(user) {
    const aliases = JSON.parse(localStorage.getItem('fot-ai-admin-aliases-v1') || '{}');
    const localName = aliases[user.id] || user.username || user.name;
    return `
      <div class="ft-admin-row">
        <label class="ft-admin-select"><input type="checkbox" data-admin-select="users" value="${esc(user.id)}"><span class="ft-sr-only">Выбрать пользователя</span></label>
        <b>${esc(localName)}</b>
        <span>${esc(user.username || user.name || '')}<small class="ft-user-origin">${user.authProvider === 'password' ? 'Login/password account' : `Browser · ${esc(user.deviceName || user.id)}`} · source: ${esc(user.trafficSource || 'direct')}</small></span>

        <label>
          Баланс
          <input type="number" min="0" value="${Number(user.balance) || 0}" data-user-balance="${esc(user.id)}">
        </label>

        <button class="ft-mini" data-action="save-user-balance" data-user-id="${esc(user.id)}">Сохранить</button>
        <label>
          Локальное имя
          <input value="${esc(aliases[user.id] || '')}" placeholder="Только для админки" data-user-alias="${esc(user.id)}">
        </label>
        <button class="ft-mini" data-action="save-user-alias" data-user-id="${esc(user.id)}">Переименовать</button>
        <label class="ft-receipt-upload">
          Чек самозанятого
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" data-receipt-file="${esc(user.id)}">
        </label>
        <button class="ft-mini" data-action="send-receipt" data-user-id="${esc(user.id)}">Приложить чек</button>
      </div>
    `;
  }

  function errorRow(item) {
    return `
      <details class="ft-admin-item is-error" open>
        <summary>${esc(item.title)} <span>${formatDate(item.createdAt)}</span></summary>
        <pre>${esc(JSON.stringify(item.details || {}, null, 2))}</pre>
      </details>
    `;
  }

  function activeRow(item) {
    return `
      <div class="ft-admin-item is-active">
        <b>${esc(item.userName)} · ${esc(item.selected?.title || '')}</b>
        <span>${formatDate(item.startedAt)}</span>
      </div>
    `;
  }

  function feedbackRow(item) {
    return `
      <article class="ft-admin-item ${item.unread ? 'is-new' : ''}">
        <b>${esc(item.type)}${item.unread ? ' · NEW' : ''}</b>
        <p><b>Имя:</b> ${esc(item.name)}</p>
        <p><b>Контакт:</b> ${esc(item.contact || 'не указан')}</p>
        <p><b>Сообщение:</b> ${esc(item.message || 'без текста')}</p>
        ${item.fileUrl ? `<a class="ft-mini" href="${esc(item.fileUrl)}" download>Скачать файл</a>` : ''}
        <small>${formatDate(item.createdAt)}</small>
      </article>
    `;
  }

  function photoRow(item) {
    return `
      <article class="ft-photo-compare">
        <div>
          <b>До</b>
          ${item.sourceUrl ? `<img src="${esc(item.sourceUrl)}" alt="source">` : '<span>нет</span>'}
        </div>

        <div>
          <b>После</b>
          ${item.resultUrl ? `<img src="${esc(item.resultUrl)}" alt="result">` : '<span>нет</span>'}
        </div>

        <p>${esc(item.styleTitle)} · ${esc(item.provider)} · ${esc(item.userName)}</p>

        ${item.sourceUrl ? `<a class="ft-mini" href="${esc(item.sourceUrl)}" download>Скачать до</a>` : ''}
        ${item.resultUrl ? `<a class="ft-mini" href="${esc(item.resultUrl)}" download>Скачать после</a>` : ''}
      </article>
    `;
  }

  function sessionRow(session) {
    return `
      <details class="ft-admin-item ${session.unread ? 'is-new' : ''}">
        <summary>
          ${session.unread ? 'NEW · ' : ''}${esc(session.user?.username || session.id)} · ${session.entriesCount} событий · ${session.errorsCount} ошибок
        </summary>

        ${(session.important || session.entries || [])
          .slice(0, 16)
          .map(
            (entry) => `
            <div class="ft-logline ${entry.level === 'error' ? 'is-error' : ''}">
              <b>${esc(entry.title)}</b>
              <span>${entry.level} · ${formatDate(entry.createdAt)}</span>
            </div>
          `,
          )
          .join('')}
      </details>
    `;
  }

  function bottomNav() {
    return `
      <nav class="ft-bottom-nav">
        <button class="${state.page === 'home' ? 'is-active' : ''}" data-action="nav" data-page="home" type="button">Главная</button>
        <button class="${state.page === 'profile' ? 'is-active' : ''}" data-action="nav" data-page="profile" type="button">Личный кабинет</button>
        <button class="${state.page === 'admin' ? 'is-active' : ''}" data-action="nav" data-page="admin" type="button">Админ</button>
      </nav>
    `;
  }

  function renderToast() {
    const node = document.getElementById('ft-toast');
    if (!node) return;

    node.innerHTML = state.message
      ? `<div class="ft-toast ${state.message.type}">${esc(state.message.text)}</div>`
      : '';
  }

  function renderProgress() {
    const node = document.getElementById('ft-progress');
    if (!node) return;

    if (!state.progress) {
      node.innerHTML = '';
      return;
    }

    node.innerHTML = `
      <div class="ft-progress-card">
        <b>${esc(state.progress.title)}</b>
        <span>${esc(state.progress.step)}</span>
        <small>${esc(state.progress.eta)}</small>
        <i style="width:${state.progress.percent}%"></i>
      </div>
    `;
  }

  function updateStylesOnly() {
    const host = document.getElementById('ft-styles-host');
    if (host) host.innerHTML = stylesList();
  }

  function selectStyle(id) {
    const style = state.styles.find((item) => String(item.id) === String(id));
    if (!style) return;

    state.selectedStyle = style;

    audit('Стиль выбран', {
      styleId: style.id,
      title: style.title,
      provider: style.provider,
    });

    qsa('.ft-style-card').forEach((node) => {
      node.classList.toggle('is-selected', String(node.dataset.styleId) === String(id));
    });

    const note = qs('.ft-selected-note');
    if (note) {
      note.innerHTML = selectedStyleMarkup(style);
    }

    const btn = qs('[data-action="generate"]');
    if (btn) btn.disabled = !canGenerate();
    toast('Стиль выбран. Следующий шаг — загрузите фото.');
  }

  async function refreshBalance(silent = false) {
    try {
      const data = await apiPost('/balance/refresh');

      syncFromServer(data);
      render();

      if (!silent) toast('Баланс обновлён');
    } catch (error) {
      toast('Не удалось обновить баланс', 'error');

      await audit('Ошибка синхронизации баланса', { message: error.message }, 'error', 'balance_error');
    }
  }

  async function updateGuestProfile(patch) {
    state.user = { ...state.user, ...patch };
    try {
      const data = await apiPost('/profile/update', patch);
      if (data.user) state.user = data.user;
      render();
      toast('Гостевой профиль сохранён');
    } catch (error) {
      render();
      toast('Не удалось сохранить профиль', 'error');
    }
  }

  function showAuthHelp() {
    if (state.user?.authProvider === 'password') {
      state.page = 'profile';
      render();
      return;
    }
    showPasswordIdentity();

    audit('Открыта подсказка авторизации');
  }

  function showWelcome() {
    modal(
      'Добро пожаловать в FOT AI',
      `<div class="ft-welcome-motion" role="img" aria-label="FOT AI creates a photo">
         <span class="ft-welcome-orb ft-welcome-orb-a"></span>
         <span class="ft-welcome-orb ft-welcome-orb-b"></span>
         <span class="ft-welcome-spark">✦</span>
         <span class="ft-welcome-frame"><b>F</b><i>✧</i></span>
       </div>
       <p>${esc(translatedText('Выберите, как начать. Гостевой режим подходит для знакомства, а аккаунт по логину сохраняет историю и чеки для восстановления на другом устройстве.'))}</p>
       <div class="ft-welcome-actions">
         <button class="ft-btn ft-primary" data-action="welcome-guest" type="button">${esc(translatedText('Продолжить как гость'))}</button>
         <button class="ft-btn" data-action="welcome-password" type="button">${esc(translatedText('Войти или создать аккаунт'))}</button>
       </div>
       <button class="ft-btn ft-welcome-password" data-action="welcome-password" type="button">${esc(translatedText('Войти по логину'))}</button>
       <p class="ft-muted">${esc(translatedText('Выберите аватар гостя и фон прямо сейчас:'))}</p>
       <div class="ft-welcome-avatar-preview gradient-${esc(state.user.avatarGradient || 'lime')}" data-welcome-avatar-preview aria-live="polite">
         <span>${esc(state.user.avatarEmoji || '✨')}</span>
         <small>${esc(translatedText('Так будет выглядеть ваш профиль'))}</small>
       </div>
       <div class="ft-welcome-avatar-row">
         ${['✨', '🌿', '🪩', '🌙', '🎨', '🫧'].map((emoji) => `<button class="ft-mini ${state.user.avatarEmoji === emoji ? 'is-active' : ''}" data-action="welcome-avatar" data-emoji="${emoji}" type="button">${emoji}</button>`).join('')}
       </div>
       <div class="ft-welcome-avatar-row">
         ${['lime', 'violet', 'sunset', 'ocean'].map((gradient) => `<button class="ft-mini ${state.user.avatarGradient === gradient ? 'is-active' : ''}" data-action="welcome-gradient" data-gradient="${gradient}" type="button">${esc(translatedText(gradient))}</button>`).join('')}
       </div>`,
      'Понятно',
      () => {
        localStorage.setItem('fot-ai-welcome-v1', 'seen');
        closeModal();
      },
    );
  }

  function showPasswordIdentity() {
    modal(
      'Вход на этом устройстве',
      `<p class="ft-muted">${esc(translatedText('Для первого входа создайте личный профиль. Он хранит только данные, созданные вами в FOT AI.'))}</p>
       <label class="ft-field"><span>${esc(translatedText('Логин'))}</span><input data-identity-login autocomplete="username" minlength="3" maxlength="48" placeholder="${esc(translatedText('например, natalia'))}" /></label>
       <label class="ft-field"><span>${esc(translatedText('Пароль'))}</span><input data-identity-password type="password" autocomplete="current-password" minlength="10" placeholder="${esc(translatedText('не менее 10 символов'))}" /></label>
       <label class="ft-consent"><input data-identity-consent type="checkbox"> <span>${esc(translatedText('Я согласен(на) на обработку моих данных для работы FOT AI. Фото, генерации, чеки и история удаляются через 14 дней; данные собираются только после самостоятельной регистрации.'))}</span></label>
       <div class="ft-welcome-actions">
         <button class="ft-btn ft-primary" data-action="identity-login" type="button">${esc(translatedText('Войти'))}</button>
         <button class="ft-btn" data-action="identity-register" type="button">${esc(translatedText('Создать профиль'))}</button>
       </div>`,
      'Закрыть',
      closeModal,
    );
  }

  async function submitPasswordIdentity(register) {
    const login = String(qs('[data-identity-login]')?.value || '').trim();
    const password = String(qs('[data-identity-password]')?.value || '');
    if (!login || !password) return toast('Введите логин и пароль', 'error');
    if (register && !qs('[data-identity-consent]')?.checked)
      return toast('Подтвердите согласие на обработку данных', 'error');
    try {
      const response = await fetch(`${API}/identity/${register ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password, displayName: login }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.sessionToken) throw new Error(data?.message || 'Не удалось войти');
      state.user = { ...state.user, ...data.profile };
      state.authToken = data.sessionToken;
      sessionStorage.setItem('fot-ai-identity-session-v1', data.sessionToken);
      localStorage.setItem('fot-ai-welcome-v1', 'seen');
      closeModal();
      await loadState();
      render();
      toast(register ? 'Профиль создан' : 'Вы вошли в аккаунт');
    } catch (error) {
      toast(error.message || 'Не удалось войти', 'error');
    }
  }

  function showBonusHelp() {
    modal(
      'Авторизация и бонусы',
      `
        <p>Иногда мы добавляем бонусы, скидки и дополнительные генерации.</p>
        <p>Следите за уведомлениями в личном кабинете: важные новости и промо будут появляться там.</p>
      `,
      'Понятно',
      closeModal,
    );

    audit('Открыта подсказка бонусов');
  }

  function showNotifications() {
    const items = state.notifications.length
      ? state.notifications
          .map((n) => {
            const receiptUrl = n.receiptUrl ? new URL(n.receiptUrl, window.location.origin) : null;
            if (receiptUrl)
              Object.entries(state.user).forEach(([key, value]) => receiptUrl.searchParams.set(key, value));

            return `
            <article class="ft-note ${n.unread ? 'is-new' : ''}">
              <b>${esc(n.title)}${n.unread ? ' · NEW' : ''}</b>
              <p>${esc(n.message)}</p>
              ${receiptUrl ? `<a class="ft-mini" href="${esc(receiptUrl.toString())}" download>Скачать чек</a>` : ''}
              <small>${formatDate(n.createdAt)}</small>
            </article>
          `;
          })
          .join('')
      : '<p>Новых уведомлений нет.</p>';

    modal('Уведомления', items, 'Прочитано', async () => {
      await apiPost('/notifications/read');
      state.notifications = state.notifications.map((n) => ({ ...n, unread: false }));
      closeModal();
      render();
    });
  }

  function modal(title, html, actionText = 'Закрыть', onAction = closeModal) {
    closeModal();

    const overlay = document.createElement('div');

    overlay.className = 'ft-modal';
    overlay.innerHTML = `
      <section>
        <button class="ft-modal-close" data-action="close-modal" type="button">×</button>
        <h2>${esc(translatedText(title))}</h2>
        <div>${html}</div>
        <button class="ft-generate" data-action="modal-action" type="button">${esc(translatedText(actionText))}</button>
      </section>
    `;

    overlay._ftAction = onAction;
    document.body.appendChild(overlay);
    applyLanguage(overlay);
  }

  function closeModal() {
    qsa('.ft-modal').forEach((m) => m.remove());
  }

  function openUrl(url, label) {
    audit(`Переход в соцсеть: ${label}`, { url }, 'info', 'social_click');
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleFile(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('Нужен файл изображения', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast('Файл больше 10 МБ', 'error');
      return;
    }

    state.file = file;
    state.filePreview = URL.createObjectURL(file);

    await audit('Исходное фото загружено', { name: file.name, size: file.size }, 'info', 'photo_selected');

    render();
  }

  async function generate() {
    if (state.busy) return;

    if (!state.participant || !state.selectedStyle || !state.file) {
      toast('Выберите участника, стиль и фото', 'error');
      return;
    }

    if (state.balance < state.cost) {
      toast(`Недостаточно кредитов: нужно ${state.cost}, доступно ${state.balance}`, 'error');

      await audit(
        'Ошибка генерации',
        {
          message: 'Недостаточно кредитов',
          balance: state.balance,
          cost: state.cost,
        },
        'error',
        'generation_error',
      );

      return;
    }

    state.busy = true;
    state.progress = {
      title: 'Создаём AI-фото',
      step: 'Загрузка фото',
      eta: '≈ 30–60 сек',
      percent: 18,
    };

    renderProgress();

    await audit(
      'Генерация запущена',
      {
        selected: state.selectedStyle,
        participant: state.participant,
      },
      'info',
      'generation_start',
    );

    try {
      const form = new FormData();

      Object.entries(
        apiPayload({
          participant: state.participant,
          participantId: state.participant,
          styleId: state.selectedStyle.id,
          styleTitle: state.selectedStyle.title,
          title: state.selectedStyle.title,
          provider: state.selectedStyle.provider,
          styleProvider: state.selectedStyle.provider,
          mode: state.selectedStyle.provider,
        }),
      ).forEach(([k, v]) => form.append(k, v));

      form.append('photo', state.file, state.file.name);

      state.progress = {
        title: 'Создаём AI-фото',
        step: 'Обработка изображения',
        eta: 'идёт генерация',
        percent: 62,
      };

      renderProgress();

      const res = await fetch(`${API}/generate`, {
        method: 'POST',
        headers: state.authToken ? { 'x-fot-session': state.authToken } : {},
        body: form,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.ok === false) {
        throw new Error(json.message || `HTTP ${res.status}`);
      }

      const normalizedGeneration = json.generation
        ? json.generation
        : {
            id: json.generationId || json.id || `legacy_${Date.now()}`,
            styleId: state.selectedStyle.id,
            styleTitle: json.styleTitle || json.styleName || state.selectedStyle.title,
            provider: json.provider || json.styleProvider || state.selectedStyle.provider,
            participant: state.participant,
            sourceUrl: json.sourceUrl || json.originalPhotoUrl || json.originalUrl || '',
            resultUrl:
              json.resultUrl || json.resultImageUrl || json.resultImage || json.imageUrl || json.url || '',
            cost: Number(json.cost || json.costCredits || state.cost),
            balanceAfter: Number.isFinite(Number(json.balanceAfter)) ? Number(json.balanceAfter) : undefined,
            createdAt: json.createdAt || new Date().toISOString(),
            status: 'success',
          };

      if (!normalizedGeneration.resultUrl) {
        throw new Error('Сервер не вернул ссылку на результат генерации');
      }

      if (typeof json.balance === 'number') {
        state.balance = json.balance;
      } else if (Number.isFinite(Number(json.balanceAfter))) {
        state.balance = Number(json.balanceAfter);
      }

      state.generations = [
        normalizedGeneration,
        ...state.generations.filter((g) => g.id !== normalizedGeneration.id),
      ];
      state.currentResult = normalizedGeneration;

      try {
        await apiPost('/generations/record', { generation: normalizedGeneration });
      } catch (recordError) {
        await audit(
          'Admin generation record failed',
          { message: recordError.message, generation: normalizedGeneration },
          'error',
          'generation_record_error',
        );
      }

      state.progress = {
        title: 'AI-фото готово',
        step: 'Сохраняем результат',
        eta: 'готово',
        percent: 100,
      };

      renderProgress();
      toast('Готово, фото уже на экране');

      await audit('Генерация завершена', { generation: json.generation }, 'info', 'generation_success');

      setTimeout(() => {
        state.progress = null;
        renderProgress();
      }, 1200);

      render();
    } catch (error) {
      toast(error.message || 'Генерация не сработала', 'error');

      state.progress = null;
      renderProgress();

      await audit(
        'Ошибка генерации',
        {
          message: error.message,
          selected: state.selectedStyle,
        },
        'error',
        'generation_error',
      );
    } finally {
      state.busy = false;
    }
  }

  async function submitFeedback(form) {
    const data = new FormData(form);

    Object.entries(apiPayload()).forEach(([k, v]) => data.append(k, v));

    try {
      const res = await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: state.authToken ? { 'X-FOT-Session': state.authToken } : {},
        body: data,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.ok === false) {
        throw new Error(json.message || `HTTP ${res.status}`);
      }

      toast('Сообщение отправлено');
      form.reset();

      await audit('Обратная связь отправлена', { kind: data.get('kind') }, 'info', 'feedback');
    } catch (error) {
      toast(error.message || 'Не удалось отправить сообщение', 'error');

      await audit('Ошибка обратной связи', { message: error.message }, 'error', 'feedback_error');
    }
  }

  function tokenRequest(packageInfo = {}) {
    const credits = Number(packageInfo.credits || 0);
    const amount = Number(packageInfo.amount || 0);
    const currency = String(packageInfo.currency || state.currency);
    const packageName =
      CREDIT_PACKAGES.find((item) => item.key === packageInfo.package)?.name || 'Пакет кредитов';

    modal(
      'Заявка на оплату',
      `
        <p><b>${esc(packageName)}</b> · ${credits} кредитов</p>
        <p class="ft-payment-total">${esc(formatMoney(amount, currency))}</p>
        <p>Оплата оформляется самозанятому после подтверждения реквизитов. Не переводите деньги до получения подтверждения.</p>
        <p>После проверки оплаты чек из «Мой налог» появится в уведомлениях личного кабинета.</p>
      `,
      'Отправить заявку',
      async () => {
        await submitTokenRequest({ packageName, credits, amount, currency });
      },
    );
  }

  async function submitTokenRequest({ packageName, credits, amount, currency }) {
    const form = new FormData();

    Object.entries(
      apiPayload({
        kind: 'Запрос токенов',
        type: 'token_request',
        name: state.user.name,
        contact: state.user.username,
        message: `Клиент запросил пакет «${packageName}»: ${credits} кредитов, ${amount} ${currency}`,
        packageName,
        credits,
        amount,
        currency,
      }),
    ).forEach(([k, v]) => form.append(k, v));

    try {
      const res = await fetch(`${API}/feedback`, {
        method: 'POST',
        body: form,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.ok === false) {
        throw new Error(json.message || `HTTP ${res.status}`);
      }

      closeModal();
      toast('Заявка на оплату отправлена');
    } catch (error) {
      toast('Заявка не отправилась', 'error');

      await audit('Ошибка запроса токенов', { message: error.message }, 'error', 'token_request_error');
    }
  }

  function requestAdminAccess() {
    modal(
      'Вход в админ-консоль',
      `
        <p class="ft-muted">Введите PIN администратора. Личный кабинет и баланс этот PIN не запрашивают.</p>
        <label class="ft-admin-pin-label">
          PIN администратора
          <input class="ft-admin-pin-input" type="password" inputmode="numeric" autocomplete="off" maxlength="32" data-admin-pin-input>
        </label>
      `,
      'Войти',
      async () => {
        const input = qs('[data-admin-pin-input]');
        const pin = String(input?.value || '').trim();

        if (!pin) {
          toast('Введите PIN администратора', 'error');
          input?.focus();
          return;
        }

        try {
          const res = await fetch('/api/admin-pin/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin }),
          });
          const json = await res.json().catch(() => ({}));

          if (!res.ok || json.ok === false) throw new Error(json.message || 'Неверный PIN');

          state.adminPin = pin;
          closeModal();
          await loadAdmin();
        } catch (error) {
          state.adminPin = '';
          toast(error.message || 'Неверный PIN администратора', 'error');
          input?.select();
        }
      },
    );

    setTimeout(() => qs('[data-admin-pin-input]')?.focus(), 0);
  }

  async function loadAdmin() {
    if (!state.adminPin) {
      requestAdminAccess();
      return;
    }

    try {
      const data = await apiGet('/admin');

      state.admin = data;
      render();
    } catch (error) {
      if (/403|FORBIDDEN|PIN/i.test(String(error.message || ''))) {
        state.adminPin = '';
        state.admin = null;
        requestAdminAccess();
        return;
      }

      toast('Админка не загрузилась', 'error');

      await audit('Ошибка загрузки админки', { message: error.message }, 'error', 'admin_error');
    }
  }

  async function saveUserBalance(userId) {
    const input = qs(`[data-user-balance="${CSS.escape(userId)}"]`);
    const balance = Number(input?.value || 0);

    try {
      await apiPost('/balance/set', { userId, balance });

      toast('Баланс пользователя сохранён');

      await loadAdmin();
      await refreshBalance(true);
    } catch (error) {
      toast('Баланс не сохранился', 'error');

      await audit(
        'Ошибка изменения баланса',
        { message: error.message, userId },
        'error',
        'admin_balance_error',
      );
    }
  }

  async function sendReceipt(userId) {
    const input = qs(`[data-receipt-file="${CSS.escape(userId)}"]`);
    const file = input?.files?.[0];

    if (!file) {
      toast('Сначала выберите файл чека', 'error');
      return;
    }

    try {
      const form = new FormData();
      form.append('userId', userId);
      form.append('receipt', file);
      form.append('message', 'Оплата подтверждена. Чек самозанятого приложен к уведомлению.');

      const res = await fetch(`${API}/receipt/send`, {
        method: 'POST',
        headers: state.adminPin ? { 'X-Admin-Pin': state.adminPin } : {},
        body: form,
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.ok === false) throw new Error(json.message || `HTTP ${res.status}`);

      toast('Чек приложен и отправлен клиенту');

      await loadAdmin();
    } catch (error) {
      toast(error.message || 'Чек не отправился', 'error');
    }
  }

  function historyId(generation) {
    return String(generation?.id || generation?.generationId || '');
  }

  function toggleHistorySelection(id) {
    const value = String(id || '');
    if (!value) return;

    state.historySelected = state.historySelected.includes(value)
      ? state.historySelected.filter((item) => item !== value)
      : [...state.historySelected, value];

    render();
  }

  async function deleteHistory(ids) {
    const selected = Array.from(new Set((ids || []).map((id) => String(id || '')).filter(Boolean)));
    if (!selected.length) return;

    const message =
      selected.length === 1
        ? 'Удалить это изображение из истории? Восстановить его после удаления не получится.'
        : `Удалить выбранные изображения (${selected.length})? Восстановить их после удаления не получится.`;

    if (!window.confirm(message)) return;

    try {
      const json = await apiPost('/generations/delete', { ids: selected });
      state.generations = Array.isArray(json.generations)
        ? json.generations
        : state.generations.filter((generation) => !selected.includes(historyId(generation)));
      state.historySelected = [];
      state.historySelectMode = false;
      render();
      toast(json.deletedCount === 1 ? 'Изображение удалено' : `Удалено изображений: ${json.deletedCount}`);
    } catch (error) {
      toast(error.message || 'Не удалось удалить изображения', 'error');
    }
  }

  function formatDate(value) {
    if (!value) return '';

    try {
      const locale = state.language === 'vi' ? 'vi-VN' : state.language === 'en' ? 'en-US' : 'ru-RU';
      return new Date(value).toLocaleString(locale, {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return value;
    }
  }

  async function handleClick(event) {
    const modalNode = event.target.closest('.ft-modal');

    if (modalNode && event.target === modalNode) {
      closeModal();
    }

    const el = event.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;

    if (action === 'nav') {
      state.page = el.dataset.page || 'home';

      await audit(`Переход: ${state.page}`, {}, 'info', 'navigation');

      if (state.page === 'admin') await loadAdmin();
      else render();

      return;
    }

    if (action === 'participant') {
      state.participant = el.dataset.id;
      render();
      await audit('Участник выбран', { participant: state.participant });
      return;
    }

    if (action === 'style') {
      selectStyle(el.dataset.styleId);
      return;
    }

    if (action === 'provider') {
      state.styleFilter = el.dataset.provider || 'Все';
      state.pageIndex = 0;
      render();
      await audit(`Фильтр стилей: ${state.styleFilter}`);
      return;
    }

    if (action === 'view') {
      state.view = el.dataset.view === 'carousel' ? 'carousel' : 'grid';
      localStorage.setItem('fototime-view-v14', state.view);
      state.pageIndex = 0;
      render();
      toast(state.view === 'carousel' ? 'Включена лента стилей' : 'Включена плитка стилей');
      return;
    }

    if (action === 'styles-prev') {
      state.pageIndex = Math.max(0, state.pageIndex - 1);
      updateStylesOnly();
      return;
    }

    if (action === 'styles-next') {
      state.pageIndex += 1;
      updateStylesOnly();
      return;
    }

    if (action === 'refresh-balance') {
      await refreshBalance();
      return;
    }

    if (action === 'go-profile') {
      state.page = 'profile';
      render();
      return;
    }

    if (action === 'auth-help') {
      showAuthHelp();
      return;
    }

    if (action === 'welcome-guest') {
      localStorage.setItem('fot-ai-welcome-v1', 'seen');
      closeModal();
      toast('Гостевой режим включён');
      return;
    }

    if (action === 'welcome-password') {
      showPasswordIdentity();
      return;
    }

    if (action === 'identity-login' || action === 'identity-register') {
      await submitPasswordIdentity(action === 'identity-register');
      return;
    }

    if (action === 'account-switch') {
      changeAccount();
      return;
    }

    if (action === 'sign-out') {
      changeAccount();
      return;
    }

    if (action === 'welcome-avatar' || action === 'welcome-gradient') {
      const patch =
        action === 'welcome-avatar'
          ? { avatarEmoji: el.dataset.emoji }
          : { avatarGradient: el.dataset.gradient };
      state.user = { ...state.user, ...patch };
      const preview = qs('[data-welcome-avatar-preview]');
      if (preview) {
        preview.className = `ft-welcome-avatar-preview gradient-${state.user.avatarGradient || 'lime'}`;
        const emoji = preview.querySelector('span');
        if (emoji) emoji.textContent = state.user.avatarEmoji || '✨';
      }
      qsa('[data-action="welcome-avatar"]').forEach((button) => button.classList.toggle('is-active', button.dataset.emoji === state.user.avatarEmoji));
      qsa('[data-action="welcome-gradient"]').forEach((button) => button.classList.toggle('is-active', button.dataset.gradient === state.user.avatarGradient));
      try {
        await apiPost('/profile/update', patch);
        toast('Настройка гостевого профиля сохранена');
      } catch (_) {
        toast('Не удалось сохранить настройку', 'error');
      }
      return;
    }

    if (action === 'install-dismiss') {
      state.installHintVisible = false;
      localStorage.setItem('fot-ai-install-hint-v1', 'hidden');
      render();
      return;
    }

    if (action === 'bonus-help') {
      showBonusHelp();
      return;
    }

    if (action === 'avatar-emoji') {
      await updateGuestProfile({ avatarEmoji: el.dataset.emoji });
      return;
    }

    if (action === 'avatar-gradient') {
      await updateGuestProfile({ avatarGradient: el.dataset.gradient });
      return;
    }

    if (action === 'show-notifications') {
      showNotifications();
      return;
    }

    if (action === 'generate') {
      await generate();
      return;
    }

    if (action === 'create-more') {
      state.file = null;
      state.filePreview = '';
      state.currentResult = null;
      render();
      toast('Выберите новое фото в блоке «Фото».');
      return;
    }

    if (action === 'share-result') {
      await shareResult(el.dataset.url);
      return;
    }

    if (action === 'download-result') {
      await downloadResult(el.dataset.url);
      return;
    }

    if (action === 'token-request') {
      tokenRequest(el.dataset);
      return;
    }

    if (action === 'history-select-mode') {
      state.historySelectMode = !state.historySelectMode;
      state.historySelected = [];
      render();
      return;
    }

    if (action === 'history-select') {
      toggleHistorySelection(el.dataset.id);
      return;
    }

    if (action === 'history-select-all') {
      const allIds = state.generations.map(historyId).filter(Boolean);
      state.historySelected = state.historySelected.length === allIds.length ? [] : allIds;
      render();
      return;
    }

    if (action === 'history-delete-one') {
      await deleteHistory([el.dataset.id]);
      return;
    }

    if (action === 'history-delete-selected') {
      await deleteHistory(state.historySelected);
      return;
    }

    if (action === 'history-share-one') {
      await shareGenerations([el.dataset.id]);
      return;
    }

    if (action === 'history-share-selected') {
      await shareGenerations(state.historySelected);
      return;
    }

    if (action === 'load-admin') {
      await loadAdmin();
      return;
    }

    if (action === 'download-audit') {
      const url = new URL(`${API}/admin/audit-download`, window.location.origin);
      Object.entries(state.user).forEach(([key, value]) => url.searchParams.set(key, value));
      if (state.adminPin) url.searchParams.set('pin', state.adminPin);
      window.open(url.toString(), '_blank');
      return;
    }

    if (action === 'admin-read-all') {
      await apiPost('/admin/read-all');
      await loadAdmin();
      return;
    }

    if (action === 'admin-clear-audit') {
      if (
        !window.confirm('Очистить журнал аудита и ошибок? Фото, пользователи, баланс и обращения сохранятся.')
      )
        return;
      await apiPost('/admin/audit-clear');
      await loadAdmin();
      toast('Аудит очищен');
      return;
    }

    if (action === 'admin-bulk-clear') {
      const scope = el.dataset.scope;
      const all = el.dataset.all === 'true';
      const ids = qsa(`[data-admin-select="${CSS.escape(scope)}"]:checked`).map((input) => input.value);
      if (!all && !ids.length) return toast('Сначала выберите записи', 'error');
      const label = all ? 'все записи этого блока' : `${ids.length} выбранных записей`;
      if (!window.confirm(`Удалить ${label}? Это действие нельзя отменить.`)) return;
      await apiPost('/admin/bulk-delete', { scope, ids, all });
      await loadAdmin();
      toast('Данные удалены');
      return;
    }

    if (action === 'admin-logout') {
      state.admin = null;
      state.adminPin = '';
      state.page = 'home';
      render();
      return;
    }

    if (action === 'save-user-balance') {
      await saveUserBalance(el.dataset.userId);
      return;
    }

    if (action === 'save-user-alias') {
      const input = qs(`[data-user-alias="${CSS.escape(el.dataset.userId)}"]`);
      const aliases = JSON.parse(localStorage.getItem('fot-ai-admin-aliases-v1') || '{}');
      const alias = String(input?.value || '').trim();
      if (alias) aliases[el.dataset.userId] = alias;
      else delete aliases[el.dataset.userId];
      localStorage.setItem('fot-ai-admin-aliases-v1', JSON.stringify(aliases));
      render();
      toast('Локальное имя сохранено только в этой админ-консоли');
      return;
    }

    if (action === 'send-receipt') {
      await sendReceipt(el.dataset.userId);
      return;
    }

    if (action === 'modal-action') {
      event.target.closest('.ft-modal')?._ftAction?.();
      return;
    }

    if (action === 'close-modal') {
      closeModal();
      return;
    }

    if (action === 'social') {
      audit(`Переход в соцсеть: ${el.dataset.label}`, { href: el.href }, 'info', 'social_click');
      return;
    }
  }

  async function shareResult(url) {
    const full = new URL(url, window.location.origin).toString();

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'FOT AI',
          url: full,
        });
      } else {
        await navigator.clipboard.writeText(full);
      }

      toast('Ссылка на результат скопирована');

      await audit('Результат отправлен через поделиться', { url: full });
    } catch (error) {
      toast('Не удалось поделиться', 'error');
    }
  }

  async function downloadResult(url, filename = 'fot-ai-result.jpg') {
    try {
      const response = await fetch(new URL(url, window.location.origin).toString(), {
        headers: state.authToken ? { 'X-FOT-Session': state.authToken } : {},
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      toast('Изображение сохранено');
    } catch (error) {
      toast(error.message || 'Не удалось скачать изображение', 'error');
    }
  }

  async function shareGenerations(ids) {
    const selected = new Set((ids || []).map(String));
    const generations = state.generations.filter((item) => selected.has(historyId(item)) && item.resultUrl);
    if (!generations.length) return;

    try {
      const files = await Promise.all(
        generations.map(async (item, index) => {
          const response = await fetch(item.resultUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          const extension = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
          return new File([blob], `fot-ai-${historyId(item) || index + 1}.${extension}`, {
            type: blob.type || 'image/jpeg',
          });
        }),
      );

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files }))) {
        await navigator.share({ title: 'FOT AI', files });
        toast(
          files.length === 1 ? 'Фото отправлено в исходном качестве' : `Отправлено фото: ${files.length}`,
        );
      } else {
        generations.forEach((item, index) =>
          setTimeout(() => {
            const link = document.createElement('a');
            link.href = item.resultUrl;
            link.download = `fot-ai-${historyId(item) || index + 1}`;
            link.click();
          }, index * 180),
        );
        toast('Браузер не поддерживает отправку файлов — оригиналы скачаны без сжатия');
      }
      await audit('Выбранные результаты отправлены', { ids: generations.map(historyId) });
    } catch (error) {
      if (error?.name !== 'AbortError') toast('Не удалось поделиться выбранными фото', 'error');
    }
  }

  function handleInput(event) {
    const el = event.target;
    const action = el.dataset.action;

    if (action === 'search') {
      state.search = el.value;
      state.pageIndex = 0;
      updateStylesOnly();
      return;
    }

    if (action === 'theme-select') {
      setTheme(el.value);
      audit(`Тема изменена: ${state.theme}`);
      return;
    }

    if (action === 'per-page') {
      state.perPage = Number(el.value) || 12;
      localStorage.setItem('fototime-per-page-v14', state.perPage);
      state.pageIndex = 0;
      updateStylesOnly();
    }

    if (action === 'language-select') {
      state.language = el.value || 'ru';
      localStorage.setItem('fototime-language-v1', state.language);
      render();
    }

    if (action === 'currency-select') {
      state.currency = el.value || 'RUB';
      localStorage.setItem('fototime-currency-v1', state.currency);
      render();
    }
  }

  function handleSubmit(event) {
    const form = event.target.closest('[data-action="feedback-form"]');
    if (!form) return;

    event.preventDefault();
    submitFeedback(form);
  }

  function handleChange(event) {
    const action = event.target.dataset.action;

    if (action === 'file-input') {
      handleFile(event.target.files?.[0]);
    }

    if (action === 'theme-select') {
      setTheme(event.target.value);
      render();
    }

    if (action === 'per-page') {
      state.perPage = Number(event.target.value) || 12;
      localStorage.setItem('fototime-per-page-v14', state.perPage);
      state.pageIndex = 0;
      render();
    }

    if (action === 'language-select') {
      state.language = event.target.value || 'ru';
      localStorage.setItem('fototime-language-v1', state.language);
      render();
    }

    if (action === 'currency-select') {
      state.currency = event.target.value || 'RUB';
      localStorage.setItem('fototime-currency-v1', state.currency);
      render();
    }
  }

  async function init() {
    setTheme(state.theme);

    try {
      await bootstrapIdentity();
    } catch (error) {
      // Keep the existing local experience available if a network retry is
      // needed; protected server operations will still require a session.
      console.warn('[FOT AI] identity bootstrap failed', error);
    }

    document.addEventListener('click', handleClick);
    document.addEventListener('input', handleInput);
    document.addEventListener('change', handleChange);
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('pointermove', handleDesignPointer, { passive: true });
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
      const nav = document.querySelector('.ft-bottom-nav');
      if (!nav) return;
      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollY && currentScrollY > 72;
      nav.classList.toggle('is-compact', isScrollingDown);
      lastScrollY = currentScrollY;
    }, { passive: true });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });

    await loadState();
    render();
    if (!localStorage.getItem('fot-ai-welcome-v1')) setTimeout(showWelcome, 250);
  }

  init();
})();
