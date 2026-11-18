# Chat Video Studio — ویدیو از طریق ChatGPT

**Self-hosted, ChatGPT-ready video renderer. No Claude subscription, no model API key, no managed hosting requirement.**

[راهنمای نصب روی سرور مستقل](docs/SELF_HOST_FA.md) · [راهنمای کار با ChatGPT](docs/CHATGPT_FA.md) · [نکات امنیتی](docs/SECURITY.md)

این پروژه به ChatGPT اجازه می‌دهد سناریوهای ویدیو را به شکل ساختاریافته مدیریت کند و به موتور مستقل FFmpeg فرمان رندر بدهد. یک مسیر دوم نیز دارد: حتی بدون اتصال MCP می‌توان از ChatGPT درخواست فایل JSON سناریو کرد و آن را روی هر کامپیوتر سازگاری به MP4 تبدیل کرد.

> نسخه **0.2.0 — MVP شخصی**. ویدیوهای تولیدشده موشن‌گرافیک/اسلایدهای متحرک هستند، نه فیلم‌های واقع‌گرایانه. **راه‌اندازی واقعی در حساب ChatGPT وابسته به دسترسی آن حساب به اتصال سفارشی MCP است**؛ مستندات رسمی در نوامبر ۲۰۲۶ دسترسی کامل به ابزارهای سفارشی را برای Business و Enterprise/Edu توضیح می‌دهند. روی حساب Plus، مسیر آفلاین مستقل از این محدودیت است.

## امکانات پیاده‌سازی‌شده

- ساخت/خواندن/ویرایش استوری‌بورد فارسی یا انگلیسی از طریق **۶ ابزار MCP**: `create_storyboard`, `get_storyboard`, `revise_storyboard`, `render_video`, `video_status`, `list_videos`.
- خروجی ویدیوی H.264 MP4 (بدون صدا) با سه نسبت تصویر 16:9، 9:16 و 1:1؛ ۱ تا ۱۰ صحنه با مجموع حداکثر ۶۰ ثانیه.
- پیش‌نمایش PNG، افکت حرکت ملایم دوربین، رنگ‌بندی و قالب‌های headline / stats / product.
- دانلودهای امضاشده یک‌ساعته، داده پایدار روی دیسک، صف تک‌کارگره با محدودیت طول صف و جلوگیری از رندر تکراری.
- بازیابی وضعیت کارهایی که با ری‌استارت قطع شده‌اند (با برچسب «ناموفق، قابل تلاش مجدد»)، محدودیت تعداد پروژه‌ها و حجم ذخیره‌سازی، محدودسازی نرخ درخواست و بررسی Origin.
- استقرار روی Docker Compose و Caddy با HTTPS خودکار؛ هیچ سرویس اختصاصی ابری، دیتابیس یا زیرساخت شخص ثالثی لازم نیست.
- مسیر آفلاین: `npm run render:local -- examples/ravaj-intro.json output.mp4`.

## راه سریع بدون سرور و بدون اتصال MCP

پیش‌نیازها: Node 20+، Python 3، Pillow، FFmpeg دارای libx264 و فونت فارسی. در Ubuntu می‌توان Pillow و فونت‌ها را با بسته‌های سیستم نصب کرد.

```bash
npm run doctor
npm test
npm run render:local -- examples/ravaj-intro.json output.mp4
```

فایل MP4 و فایل `output-preview.png` کنار فایل خروجی ایجاد می‌شوند. ابتدا از ChatGPT درخواست یک JSON مطابق `examples/ravaj-intro.json` کنید. سپس آن را در فایل UTF-8 ذخیره و فرمان بالا را اجرا کنید. این مسیر حتی روی حساب ChatGPT فاقد ابزارهای سفارشی نیز کار می‌کند.

## راه سریع روی هر VPS با Docker

```bash
# بعد از تنظیم DNS دامنه و نصب Docker Engine و Compose
sh scripts/bootstrap-env.sh video.example.org
# فایل .env با کلیدهای امن و مجوز 600 ساخته می‌شود

docker compose up -d --build
docker compose ps
curl https://video.example.org/health
```

سرویس رندر فقط در شبکه داخلی Docker در دسترس است و Caddy تنها پورت‌های 80/443 را منتشر می‌کند. داده‌ها در `studio_data`، گواهی TLS در `caddy_data` نگهداری می‌شوند. راهنمای کامل در [SELF_HOST_FA.md](docs/SELF_HOST_FA.md) قرار دارد.

## اتصال به ChatGPT (حساب‌های واجد شرایط)

اتصال MCP به نقطه انتهایی زیر انجام می‌شود:

```text
https://video.example.org/mcp/<MCP_ACCESS_PATH>
```

کلید مسیر را پس از استقرار از فایل محرمانه `.env` روی سرور بردارید یا فقط در ترمینال خصوصی با `sh scripts/show-endpoint.sh` نمایش دهید. آن را در GitHub، کانال‌های عمومی یا گزارش خطا قرار ندهید. برای این حالت آزمایشی شخصی گزینه **No authentication** انتخاب می‌شود، زیرا **خود مسیر یک رمز دسترسی محرمانه است**. این روش جایگزین OAuth برای سرویس چندکاربره نیست. راهنمای دقیق و محدودیت پلن‌ها در [CHATGPT_FA.md](docs/CHATGPT_FA.md) آمده است.

ابزار `/mcp` نیز برای کلاینت‌هایی که از هدر `Authorization: Bearer <STUDIO_TOKEN>` پشتیبانی می‌کنند وجود دارد؛ هدر Bearer معمولاً به‌عنوان یک گزینه مستقل در فرم اتصال ChatGPT ارائه نمی‌شود.

## تست‌ها

```bash
npm test             # ۹ تست Node + ۲ تست Python
npm run test:e2e     # ثبت سناریو با MCP، رندر واقعی و دانلود MP4 امضاشده
npm run doctor       # وابستگی‌ها، کدک و فونت
```

وضعیت اتصال واقعی با یک ChatGPT حساب کاربری و اجرای Docker Compose روی VPS مشخصاً در آزمایش‌های محلی حاضر **تأیید نشده‌اند**؛ برای آن‌ها نیاز به سرور و دسترسی حساب کاربر است.

## محدودیت‌ها و توسعه آینده

گویندگی، موسیقی، بارگذاری عکس و ویدیو، صحنه‌های Three.js، فیلم‌سازی واقع‌گرایانه، کار چندکاربره، OAuth و صف توزیع‌شده هنوز پیاده نشده‌اند. این پروژه فقط برای یک مالک شخصی با کلیدهای محرمانه توصیه می‌شود. حافظه داده‌ها محلی است؛ از volume پشتیبان بگیرید.

## مجوز و انتساب

پیاده‌سازی مستقل با مجوز MIT، الهام‌گرفته از ایده پروژه [CineCode](https://github.com/sarpstar/cinecode) ساخته Sarp Yıldız است. کد آن کپی مستقیم از CineCode نیست. جزئیات در [NOTICE.md](NOTICE.md) آمده است.
