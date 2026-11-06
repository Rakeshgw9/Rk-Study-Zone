# Main flows (existing, steps 1-5)
## Landing -> Sign In popup
- Start: / ; click "Sign In" ; Expect "Welcome Back" modal
## Create account -> Portals
- Create an account (name/email/password) ; Expect redirect to Portals, "No Portal Yet"
## Create Portal
- Click "Create Your First Portal" ; fill fields ; Expect toast "Portal created successfully." and row in table
## Search/filter portals
- Type name in "Search portal by name..." ; select "Draft" ; rows filter
## Edit/Delete portal ; Log out from user menu
# New flows (steps 6-15)
- Portal row Edit icon -> Portal Builder (Step 6) ; Create First Unit modal (7) ; unit workspace (8)
- Add Chapter modal (9) ; chapter workspace (10) ; Add Block popup (11) -> editor opens (12/13/14)
- Save Block, Save Draft, Preview, Publish ; student lesson page (15) with Prev/Next, progress, notes, bookmarks, MCQ
# QA (verified locally in demo mode, desktop 1360 + mobile 375)
- Register (first = Super Admin) -> Create Portal (validation shown for category/access) -> Edit -> builder
- Create Unit -> Add Chapter -> Add HTML, JSON, MCQ blocks -> Save Block -> Publish (confirm) -> /learn lesson
- MCQ start -> answer -> submit -> result with negative marking + solutions; progress 3/3
- Tree kebab menu (duplicate / move / delete) -> Delete confirm dialog
- Second account (student) -> /learn ; /admin/* redirects student to /learn
- Light theme lesson + builder ; mobile builder pane tabs, lesson, portal cards (no horizontal overflow)
