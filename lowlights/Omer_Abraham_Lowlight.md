# Lowlights: The Agent That Turned Me Into My Wife

As a former software developer, I have used many coding tools and AI agents, so I started this project thinking there was not much left that could surprise me. I expected incorrect code, failed commands, and bad technical assumptions. What I did not expect was for Codex to decide that I was my wife.

I was working on my wife Avigail’s computer, but I was using my own Codex subscription and my own authenticated GitHub account. I had installed the GitHub CLI, which gave Codex access to push changes to our repository. However, because this was not my computer, I had never configured my Git username and email on it.

When I asked Codex to commit and push our changes, it checked the computer account and used Avigail’s name as my Git identity. Because it did not have my real email address, it used an automatically generated local email so it could finish the commit. It never stopped to ask who I was or whether the computer owner’s name was the correct identity to use.

The push succeeded, and from the terminal everything looked normal. I only noticed the problem later when I looked at the GitHub commit history. All the commits appeared under my wife’s name, even though the work was mine and the changes had been pushed using my GitHub account. The result was a strange combination: my work, my Codex subscription, and my GitHub access, but my wife listed as the author.

What went wrong was not a coding failure or a command that crashed. Codex completed exactly what I asked it to do, but it filled in missing personal information by itself. It prioritized completing the task over verifying whether its assumption about my identity was correct. That made the result technically successful but wrong from a human point of view.

What surprised me most was how silently this happened. The agent did not present the identity as a decision or ask for confirmation. Unless I inspected the commit metadata, I would not know that it had made this assumption.

I learned that giving an agent access to an account does not mean it understands who is operating the computer. In the future, before asking an agent to create commits on a new machine, I will check and configure:

```bash
git config user.name
git config user.email
```
