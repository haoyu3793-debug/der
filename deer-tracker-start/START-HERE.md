Phoenix Park Deer Tracker — starting package
凤凰公园鹿追踪器 —— 起步包

====================================================================
WHAT THIS IS  这是什么
====================================================================

deer-simulator/ is the whole website. Not a copy of part of it, not a
template — the folder IS the site. There is no build step. What you
see is what gets served.

deer-simulator/ 就是整个网站。不是它的一部分，也不是模板 —— 这个
文件夹本身就是网站。没有「构建」这一步。你看到的就是会被发出去的。

It already has git history inside it (9 commits). You are not starting
an empty repository; you are picking up one that already exists.

它里面已经带着 git 历史（9 次提交）。你不是在开一个空仓库，你是接手
一个已经存在的仓库。


====================================================================
1 · GET IT INTO UBUNTU  把它弄进 Ubuntu
====================================================================

Copy deer-tracker-start.tar.gz to somewhere on your Windows disk you
can find again — the Desktop is fine. Then, in the Ubuntu terminal:

把 deer-tracker-start.tar.gz 放到 Windows 上你找得到的地方 —— 桌面
就行。然后在 Ubuntu 终端里：

    cd ~
    cp /mnt/c/Users/YOUR-WINDOWS-NAME/Desktop/deer-tracker-start.tar.gz .
    tar -xzf deer-tracker-start.tar.gz
    cd deer-tracker-start/deer-simulator

Windows drives live under /mnt inside Ubuntu. C: is /mnt/c, A: is
/mnt/a. If you are not sure what your Windows user folder is called,
run:  ls /mnt/c/Users

在 Ubuntu 里，Windows 的盘挂在 /mnt 下面。C: 是 /mnt/c，A: 是 /mnt/a。
不确定你的 Windows 用户文件夹叫什么，就跑：  ls /mnt/c/Users

Why .tar.gz and not .zip: a freshly installed Ubuntu has tar but does
NOT have unzip. This one opens with nothing extra installed.

为什么是 .tar.gz 不是 .zip：刚装好的 Ubuntu 有 tar，但没有 unzip。
这个包不需要你先装任何东西就能解开。


====================================================================
2 · FOUR CHECKS BEFORE YOU TOUCH ANYTHING  动手之前的四项检查
====================================================================

Run these four inside deer-simulator/. All four must match. If one
does not, stop and say so — do not carry on and hope.

在 deer-simulator/ 里跑这四条。四条都必须对上。有一条对不上就停下来
说一声 —— 不要接着往下做、指望它自己会好。

    git status
      -> nothing to commit, working tree clean
         没有要提交的，工作区干净

    git ls-files | wc -l
      -> 33

    git ls-files functions | wc -l
      -> 4        (the backend: 2 endpoints x 2 files each)
                  (后端：2 个接口，每个 2 个文件)

    git ls-files vendor | wc -l
      -> 12       (fonts and the map library, kept local on purpose)
                  (字体和地图库，故意放在本地)

    git remote -v
      -> prints nothing. There is no remote yet. You add it yourself
         in the deploy stage.
         什么都不打印。现在还没有远程仓库。你会在部署那一关自己加。


====================================================================
3 · WHAT IS IN IT  里面有什么
====================================================================

  index.html            the map, the form, the list
  achievements.html     badges, counted from the server
  encyclopedia.html     the deer species pages
  info.html             park rules, hours, the ranger's number
  partials.js           the header, footer and sign-in box, injected
                        into all four
  styles.css            all the styling
  app.js                shared helpers

  functions/api/sightings.js      GET a list, POST a new sighting
  functions/api/sightings/[id].js DELETE one, if you hold its key
  functions/api/ratings.js        GET a list, POST a review
  functions/api/ratings/[id].js   DELETE one, if you hold its key
  functions/api/_auth.js          passwords, sessions, cookies. Not a
                                  URL - the endpoints import it.
  functions/api/auth/signup.js    make an account
  functions/api/auth/login.js     sign in
  functions/api/auth/logout.js    sign out
  functions/api/auth/me.js        who am I?

  schema.sql            the four tables: sightings, ratings, users,
                        sessions. Run this against D1 once.
  wrangler.toml         binds the database. One line to fill in.

  vendor/               fonts + Leaflet, local copies
  assets/               photos
  serve.ps1             runs the site on your own machine
  robots.txt  README.md  DEPLOY.md  .gitignore  .gitattributes

The file path IS the URL. functions/api/sightings.js answers
/api/sightings. Nothing configures that; it is just where the file
sits.

文件路径就是网址。functions/api/sightings.js 负责回答 /api/sightings。
没有任何配置在管这件事；它就是文件放在哪儿的结果。


====================================================================
4 · RUN IT LOCALLY, RIGHT NOW  现在就在本地跑起来
====================================================================

From Windows PowerShell, inside the deer-simulator folder:

在 Windows 的 PowerShell 里，进到 deer-simulator 文件夹：

    .\serve.ps1              just this computer  只给这台电脑
    .\serve.ps1 -Lan         also phones on the same wifi
                             同一个 WiFi 下的手机也能连

-Lan needs an administrator PowerShell. It will tell you if it cannot
bind, and print the exact addresses to type on the phone.

-Lan 需要用管理员身份打开 PowerShell。如果绑定不上它会告诉你，并且
会把手机上该输的地址原样打出来。

The sightings list will be empty until the backend is live. That is
correct, not broken — the whole point of Lesson 16 is putting the
backend behind it.

在后端上线之前，目击列表是空的。这是对的，不是坏了 —— 第 16 课整节
课要做的事，就是把后端接到它后面。


====================================================================
5 · WHERE TO GO NEXT  接下来去哪
====================================================================

Open DeerFrontend_Lesson16_Courseware.html and start at Stage 1,
"A machine with nothing on it". Do not skip it even if Ubuntu looks
ready — the first step is checking what is missing, and on a fresh
Ubuntu three of the tools are.

打开 DeerFrontend_Lesson16_Courseware.html，从关卡 1「一台什么都没
有的机器」开始。就算 Ubuntu 看起来已经好了也别跳过 —— 第一步就是
检查缺什么，而在全新的 Ubuntu 上，有三个工具是缺的。
