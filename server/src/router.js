/* eslint-disable import/default */
/* eslint-disable no-unused-vars */
import passport from 'passport';
import * as auth from './controllers/auth';
import passportConfig from './services/passport';

import * as shortner from './controllers/shortner';
import torrents from './controllers/torrent';
import search from './controllers/search';
import backend from './services/backend';
import ws from './services/ws';
import secret from './config/secret'

const requireAuth = passport.authenticate('jwt', {session: false });
const requireSignIn = passport.authenticate('local', {session: false });
const google = passport.authenticate('google', {scope: ['email']});
const googleCallback = passport.authenticate('google', {session: false, scope: 'https://www.googleapis.com/auth/plus.login'});
const facebook = passport.authenticate('facebook', {session: false, scope: ['email'] });
const facebookCallback = passport.authenticate('facebook', {session: false, scope: [] });

export default function(app) {
    //Home Controllers
    app.get('/', requireAuth, (req, res) => {
      res.send('hi ' + req.user.name);
    });


    //User info Controllers
    app.get('/user', requireAuth, (req, res) => {
      const user = {
        name: req.user.name,
        email: req.user.email,
        picture: req.user.picture
      }
      res.send(user);
    });


    //Auth Controllers
    app.post('/signin', requireSignIn, auth.signin);
    app.post('/signup', auth.signup);
    app.post('/resetpassword', auth.resetPassword);
    app.get('/auth/google', google, auth.googleSignIn);
    app.get('/auth/google/callback', googleCallback, auth.googleSignInCallback);
    app.get('/auth/facebook', facebook , auth.facebookSignIn);
    app.get('/auth/facebook/callback', facebookCallback, auth.facebookSignInCallback);

    //Shortner Controllers
    app.post('/short', shortner.post);
    app.get('/s/:hash', shortner.get);


    //hook http to  websocket
    // ws.install(app);

    //Torrent Controllers
    api('torrents', torrents);

    //Torrent Search Controllers
    api('search', search);

    function api(name, module) {
      Object.keys(module).forEach((key) => {
        const fn = module[key];
        if (typeof fn !== "function") return;
        //dont call modules with request/response,
        //instead call with 'body' and 'callback(err, data)'
        const endpoint = '/api/' + name + '/' + key;
        console.log("POST %s -> %s.%s", endpoint, name, key);
        app.post(endpoint, (req, res) => {
          fn(req.body, (err, data) => {
            if(err) {
              res.status(400).send(err);
            } else {
              res.send(data || "OK");
            }
          });
        });
      });
    } //api function end


    let storedFiles = {};


    const update = function(newFiles) {
      //optionnaly update stored files
      if (newFiles) storedFiles = newFiles;
      //broadcast state
      ws.broadcast({
        config: secret,
        providers: search.providers,
        torrents: torrents.list,
        filesDownloading: torrents.filesDownloading,
        uploads: storedFiles
      });
    };
    search.on("update", update);
    torrents.on("update", update);

    //periodically scan for new stored files
    function list() {
      backend.list(function(err, files) {
        if(!err) update(files);
      });
    }
    setInterval(list, 15*60*1000);

} //main function end
