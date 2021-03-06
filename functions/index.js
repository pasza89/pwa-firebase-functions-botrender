const functions = require('firebase-functions');
const express = require('express');
const fetch = require('node-fetch');
const url = require('url');
const app = express();

const pwaShell = require('./pwashell');

/**
 * generateUrl() - Piece together request parts to form FQDN URL
 * @param {Object} request 
 */
const generateUrl = (request) => {

  // Why do we use functions.config().site.domain instead of the domain from
  // the request? Because it'll give you the wrong domain (pointed at the 
  // cloudfunctions.net)
  return url.format({
    protocol: request.protocol,
    host: functions.config().site.domain,
    pathname: request.originalUrl
  });
}

/**
 * checkForBots() - regex that UserAgent, find me a linkbot
 * @param {String} userAgent 
 */
const checkForBots = (userAgent) => {

    // These are link bots only!
    // DO NOT ADD GOOGLEBOT.
    // If you add Googlebot to this, you will not have a good day.
    // This is a mix of my Sam Li's list (https://github.com/webcomponents/webcomponents.org/blob/696eb6d6f1fe955db395e96d97c3d1dfe0a02b26/client/bot-filter.py#L9)
    // and my list (https://github.com/justinribeiro/blog-pwa/blob/a7174657f3e910cacf2f089c012d40bec719293e/appengine/main.py#L28)
    const botList = 'baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora\ link\ preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator|slackbot|facebot|developers\.google\.com\/\+\/web\/snippet\/'.toLowerCase();

    // FIND THE BOT AMONG THE USSSERRRS
    if(userAgent.toLowerCase().search(botList) != -1) {
      return true;
    } else {
      return false;
    }
}

// This WILL NOT run for index.html because Exact-match static content is before
// configured rewrites (see "Hosting Priorities" https://firebase.google.com/docs/hosting/url-redirects-rewrites)
// 
// The trick is on L66, pwaShell(): You must update that file! Open for explainer.
app.get('*', (req, res) => {

  // What say you bot tester?
  const botResult = checkForBots(req.headers['user-agent']);

  if (botResult) {

    // Get me the url all nice
    const targetUrl = generateUrl(req);

    // Did you read the README? You should have set functions.config().botrender.server
    // to where ever you deployed https://github.com/samuelli/bot-render on AppEngine
    fetch(`${functions.config().botrender.server}?url=${targetUrl}`)
      .then(function(res) {
        return res.text();
      }).then(function(body) {

        // This is only going to return the HEAD of the document, nothing else 
        // This is debatably AWESOME (save some bytes, give the bots only what they want)
        // See https://github.com/samuelli/bot-render/blob/master/renderer.js#L37

        // We set Vary because we only want to cache this result for the bots
        // which we know based on the user-agent. Vary is very useful.
        // Reading about Vary header: 
        //  https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary
        //  https://www.fastly.com/blog/best-practices-using-vary-header/
        res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
        res.set('Vary', 'User-Agent');
        
        res.send(body.toString());
      
    });

  } else {

    // 1. Umm, Justin, why not just point to index.html? 
    // 2. Umm, Justin, why not just fetch() index.html from the domain?
    // 
    // Valid things to ask internet peoples
    // 1. function doesn't know about the public hosting as far as I can tell (docs don't offer opinion/example)
    // 2. Could fetch and return...but I found copy+paste the index.html PWA shell into file returns faster
    res.send(pwaShell());
  }
  
});

exports.app = functions.https.onRequest(app);