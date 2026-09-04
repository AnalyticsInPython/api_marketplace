**Lowlights – What Went Wrong While Working with an Agent**
*David Lee – API Marketplace Group*

**1. The agent kept needing its sandbox disabled.**
- *Discovery:* The agent reported that my Mac only had Python 3.9 and no Node, and recommended installing both. I had already installed UV at this point. Disabling strict sandboxing would resolve the issues, but risked data leakage when pushing content to GitHub.
- *Issue:* I enabled “Manual” and “Strict Sandbox Mode” to better monitor and control the agent, but the agent kept needing the strict sandbox disabled, and Manual mode would slow things down when the group only had a few days to come up with an end-to-end, working web app.
- *Fix:* I created a new user on my Mac without admin rights. The new user would not have access to my personal files. Given that the code that ran was monitored, this addressed the primary risk of data leakage.

**2. The agent made four commits under a username that wasn’t mine.**
- *Discovery:* I pushed my work to the repository, but I wasn’t showing up in the contributor list.
- *Issue:* Because Git did not have an identity configured on my Mac, and because I had created a new user on my computer, the agent invented an identity from the hostname. The agent made four commits without checking.
- *Fix:* I had it set my GitHub identity and rebuild the commits. I also got into the habit of pulling the latest version of the repository before making changes.

**3. I found UI problems the agent had passed over.**
- *Discovery:* Going through the dashboard page by page like a user would, I found several issues that needed to be addressed, such as the collapse arrow icon being off-center, a sun rather than a gear for the settings page, table headers that were not vertically aligned, and no way to reopen the sidebar after it had been collapsed.
- *Issue:* The agent inspected pages to answer the specific questions I asked. Given that UI elements did not break builds or fail tests, none of these issues surfaced on their own.
- *Fix:* I reported each one and had the agent fix it, then confirmed the fixes by looking at the pages myself, the same way I had found them.
