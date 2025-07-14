export function authMiddleware(req, res, next) {
  if (req.session?.loggedIn) {
    return next();
  }
  res.redirect('/login');
}

export function loginHandler(req, res) {
  const { LOGIN_USER, LOGIN_PASS } = process.env;
  const { username, password } = req.body;

  if (username === LOGIN_USER && password === LOGIN_PASS) {
    req.session.loggedIn = true;
    return res.redirect('/build');
  }
  res.send(`<p>Invalid credentials. <a href="/login">Try again</a>.</p>`);
}
