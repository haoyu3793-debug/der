#!/bin/bash
# Set the site's public address, everywhere it appears.
# 设置站点的公开地址，把出现的每一处都改掉。
#
#   ./set-domain.sh https://deer.example.com
#   ./set-domain.sh https://deer-tracker-983.pages.dev
#
# Run it again whenever the address changes. It is safe to run twice.
# 地址变了就再跑一遍。跑两遍是安全的。
#
# ─────────────────────────────────────────────────────────────────────
# WHY THIS IS A SCRIPT AND NOT A SETTING
#
# The share-preview tag has to hold a full, absolute address:
#
#   <meta property="og:image" content="https://.../assets/hero-1600.jpg">
#
# When somebody pastes your link into a chat app, that app fetches the raw
# HTML and reads the tag. It does not run your JavaScript. So the address
# cannot be filled in at runtime by a script on the page - it has to be
# sitting in the file before it is served. Search and replace is the honest
# way to do that in a project with no build step, which is the whole point
# of this project.
#
# 为什么是脚本而不是一个配置项
#
# 分享预览标签里必须是完整的绝对地址。别人把你的链接粘到聊天软件里时，
# 那个软件抓的是原始 HTML，然后读这个标签 —— 它【不会】运行你的
# JavaScript。所以这个地址没法在运行时由页面上的脚本填进去，它必须在文件
# 被送出去之前就已经在那儿。在一个没有构建步骤的项目里（而「没有构建步骤」
# 正是这个项目的全部意义），搜索替换就是诚实的做法。
# ─────────────────────────────────────────────────────────────────────

set -e

NEW="$1"

if [ -z "$NEW" ]; then
  echo "usage: ./set-domain.sh https://your-domain.com"
  echo "用法:  ./set-domain.sh https://你的域名.com"
  echo
  echo "currently set to  当前设置为:"
  grep -ho 'content="[^"]*"' index.html | grep -o 'https[^"]*\|__SITE_URL__[^"]*' | head -1 | sed 's|/assets.*||' | sed 's/^/  /'
  exit 1
fi

# No trailing slash: every use in the files adds its own.
# 结尾不要斜杠：文件里每处用到的地方都会自己加。
NEW="${NEW%/}"

case "$NEW" in
  https://*) ;;
  http://*)
    echo "Refusing http://. Cloudflare gives you https for free and a share"
    echo "preview served over http is refused by most chat apps."
    echo "拒绝 http://。Cloudflare 免费给 https，而 http 的分享预览会被"
    echo "大部分聊天软件拒绝。"
    exit 1 ;;
  *)
    echo "That does not start with https:// — did you paste the whole address?"
    echo "这个不是以 https:// 开头 —— 你粘的是完整地址吗？"
    exit 1 ;;
esac

FILES="index.html achievements.html encyclopedia.html info.html README.md"
CHANGED=0

for f in $FILES; do
  [ -f "$f" ] || { echo "  missing: $f"; continue; }
  before=$(grep -c '__SITE_URL__\|https://[a-z0-9.-]*\.pages\.dev\|https://[a-z0-9.-]*\.[a-z]*/assets' "$f" || true)
  # __SITE_URL__ first, then any address already written in
  sed -i "s|__SITE_URL__|$NEW|g" "$f"
  sed -i "s|https://[a-zA-Z0-9.-]*\.pages\.dev|$NEW|g" "$f"
  after=$(grep -c "$(printf '%s' "$NEW" | sed 's/[.[\*^$]/\\&/g')" "$f" || true)
  printf "  %-22s %s\n" "$f" "$after occurrence(s)"
  CHANGED=$((CHANGED + 1))
done

echo
echo "Set to: $NEW  in $CHANGED files"
echo
echo "Anything left over? 还有漏网的吗？"
if grep -rn '__SITE_URL__\|pages\.dev' $FILES 2>/dev/null; then
  echo "  ^ those still need doing  ^ 上面这些还没改"
else
  echo "  nothing  没有了"
fi
echo
echo "Now commit and push, then paste the link into a chat app and check the"
echo "preview picture actually appears."
echo "现在提交并推送，然后把链接粘到聊天软件里，看预览图是不是真的出来了。"
