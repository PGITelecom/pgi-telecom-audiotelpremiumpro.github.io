import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";

test("production static build publishes marketing root and private cockpit",()=>{
  fs.rmSync("dist",{recursive:true,force:true});
  try{
    execFileSync(process.execPath,["scripts/build-static.mjs"],{
      env:{
        ...process.env,
        PGI_RUNTIME_MODE:"production",
        PGI_API_BASE_URL:"/api/v1",
        PGI_RELEASE_ID:"c".repeat(40),
        VERCEL_PROJECT_PRODUCTION_URL:"audiotel-premium-pro.com"
      },
      stdio:"pipe"
    });

    const root=fs.readFileSync("dist/index.html","utf8");
    const cockpit=fs.readFileSync("dist/cockpit.html","utf8");
    const legacy=fs.readFileSync("dist/site/index.html","utf8");
    const robots=fs.readFileSync("dist/robots.txt","utf8");
    const sitemap=fs.readFileSync("dist/sitemap.xml","utf8");
    const llms=fs.readFileSync("dist/llms.txt","utf8");
    const llmsFull=fs.readFileSync("dist/llms-full.txt","utf8");
    const hubspotTracking=fs.readFileSync("dist/site/hubspot-tracking.js","utf8");
    const indexNowKey=fs.readFileSync("dist/fa0a7deb5d60bdf1260c8174ad8c71db.txt","utf8").trim();
    const seoSlugs=["changer-operateur-audiotel","business-live-audiotel","monetiser-ses-appels","combien-rapporte-numero-surtaxe","audiotel-voyance","audiotel-independants","audiotel-coaching","audiotel-professionnels","reversement-audiotel","numero-sva","tarif-numero-sva","numero-surtaxe-08","portabilite-numero-sva","portabilite-prioritaire","parrainage-audiotel","comparateur-audiotel","guide-audiotel-sva","demande-ouverture","mentions-legales","conditions-utilisation","conditions-abonnement","confidentialite","accord-traitement-donnees","cookies-traceurs","resilier-contrat","retractation"];
    const seoPages=seoSlugs.map(slug=>fs.readFileSync("dist/"+slug+"/index.html","utf8"));

    assert.match(root,/Monétisez vos appels/);
    assert.match(root,/COMMENCEZ PAR VOTRE SITUATION/);
    assert.match(root,/href="\/reversement-audiotel\//);
    assert.match(root,/href="\/numero-sva\//);
    assert.match(root,/max-snippet:-1/);
    assert.doesNotMatch(root,/Cockpit \/ PGI Telecom/);
    assert.match(root,/href="\/site\/public-marketing\.css\?v=[a-z0-9._-]+"/i);
    assert.match(root,/src="site\/site\.js\?v=[a-z0-9._-]+"/i);
    assert.doesNotMatch(root,/href="\/site\/contact-widget\.css\?v=[a-z0-9._-]+"/i);
    assert.match(root,/src="\/site\/contact-widget\.js\?v=[a-z0-9._-]+"/i);
    const searchIndexUrl='/site-search-index.json?v='+'c'.repeat(12);
    assert.ok(root.includes('data-site-search-index="'+searchIndexUrl+'"'),
      "homepage search must use this release's immutable index");
    assert.ok(legacy.includes('data-site-search-index="'+searchIndexUrl+'"'),
      "legacy canonical site must use the same search index");


    // Exact CSS concatenation conserves specificity, precedence, appearance and accessibility.
    const marketingCss=fs.readFileSync("dist/site/public-marketing.css","utf8");
    const expectedCss=["site/site.css","site/contact-widget.css"].map(file=>
      "/* "+file+" */\n"+fs.readFileSync(file,"utf8")+"\n"
    ).join("\n");
    assert.equal(marketingCss,expectedCss);
    assert.match(seoPages[0],/href="\/site\/public-marketing\.css\?v=[a-z0-9._-]+"/i);
    assert.doesNotMatch(seoPages[0],/href="\/site\/contact-widget\.css/i);

    // Form and payment CSS must retain the *exact* prior concatenation order.
    for(const [slug,bundle,extraFile] of [
      ["demande-ouverture","application-marketing.css","site/application.css"],
      ["paiement-cb-audiotel","payment-marketing.css","site/payment-card.css"]
    ]){
      const css=fs.readFileSync("dist/site/"+bundle,"utf8");
      const expected=["site/site.css",extraFile,"site/contact-widget.css"].map(file=>
        "/* "+file+" */\n"+fs.readFileSync(file,"utf8")+"\n"
      ).join("\n");
      assert.equal(css,expected,slug+" must preserve the CSS cascade byte for byte");
      const page=fs.readFileSync("dist/"+slug+"/index.html","utf8");
      assert.ok(page.includes('href="/site/'+bundle+'?v='),slug+" must load only the bundle");
      assert.equal([...page.matchAll(/<link rel="stylesheet"/g)].length,1,slug+" should have one CSS request");
      assert.ok(!page.includes('href="/site/site.css'),slug+" no duplicate base styles");
      assert.ok(!page.includes('href="/site/contact-widget.css'),slug+" no duplicate widget styles");
    }
    for(const page of seoPages){
      assert.ok(page.includes('data-site-search-index="'+searchIndexUrl+'"'),"release search index missing");
      assert.ok(page.includes('src="/site/contact-widget.js?v='),"widget JavaScript missing");
      assert.ok(["public-marketing.css","contact-widget.css","application-marketing.css","payment-marketing.css"]
        .some(asset=>page.includes(asset)),"marketing/widget CSS missing");
    }

    assert.doesNotMatch(root,/\.\.\/assets\//);
    assert.match(root,/rel="canonical" href="https:\/\/audiotel-premium-pro\.com\/"/);
    assert.match(root,/property="og:url" content="https:\/\/audiotel-premium-pro\.com\/"/);
    assert.match(root,/"@type":"WebSite"/);
    assert.match(root,/"@type":"Organization"/);
    assert.match(root,/"@type":"WebPage"/);
    assert.ok(root.includes('"@id":"https://audiotel-premium-pro.com/#service"'));
    assert.ok(root.includes('"@id":"https://audiotel-premium-pro.com/#logo"'));
    assert.ok(root.includes('"contentUrl":"https://audiotel-premium-pro.com/assets/audiotel-brand-logo-v33.png"'));
    assert.match(root,/name="twitter:image" content="https:\/\/audiotel-premium-pro\.com\/assets\/audiotel-brand-logo-v33\.png"/);

    assert.match(cockpit,/Cockpit \/ PGI Telecom/);
    assert.match(cockpit,/noindex,nofollow,noarchive/);

    assert.match(legacy,/rel="canonical" href="https:\/\/audiotel-premium-pro\.com\/"/);
    assert.match(robots,/Disallow: \/cockpit/);
    for(const agent of ["Bingbot","OAI-SearchBot","Claude-SearchBot","PerplexityBot","Applebot"])assert.ok(robots.includes("User-agent: "+agent),agent+" missing from robots.txt");
    assert.match(robots,/Sitemap: https:\/\/audiotel-premium-pro\.com\/sitemap\.xml/);
    assert.match(sitemap,/<loc>https:\/\/audiotel-premium-pro\.com\/<\/loc>/);
    for(const slug of seoSlugs.filter(x=>x!=="mentions-legales"))assert.match(sitemap,new RegExp("<loc>https:\\/\\/audiotel-premium-pro\\.com\\/"+slug+"\\/<\\/loc>"));
    assert.doesNotMatch(sitemap,/mentions-legales/);
    for(const forbidden of ["client.html","cockpit","backend/","docs/"])assert.ok(!sitemap.includes(forbidden));
    assert.doesNotMatch(sitemap,/<changefreq>|<priority>/);
    const reversementLastmod=execFileSync("git",["log","-1","--format=%cs","--","site/seo/reversement-audiotel.html"],{encoding:"utf8"}).trim();
    assert.match(reversementLastmod,/^\d{4}-\d{2}-\d{2}$/);
    assert.ok(sitemap.includes("<loc>https://audiotel-premium-pro.com/reversement-audiotel/</loc>\n    <lastmod>"+reversementLastmod+"</lastmod>"));
    assert.ok(llms.includes("Audiotel Premium Pro | PGI Telecom"));
    assert.match(llms,/guide-audiotel-sva/);
    assert.match(llmsFull,/Official French references/);
    assert.match(hubspotTracking,/PORTAL_ID="149417663"/);
    assert.match(hubspotTracking,/pgi_tracking_consent_v1/);
    assert.equal(indexNowKey,"fa0a7deb5d60bdf1260c8174ad8c71db");
    seoPages.forEach((page,index)=>{
      // Evergreen public pages do not advertise artificial publication or modification dates.
      if(seoSlugs[index]!=="mentions-legales")assert.doesNotMatch(page,/"datePublished"|"dateModified"/);
      const slug=seoSlugs[index],legal=["mentions-legales","conditions-utilisation","conditions-abonnement","confidentialite","accord-traitement-donnees","cookies-traceurs","resilier-contrat","retractation"].includes(slug);
      if(slug==="mentions-legales")assert.match(page,/name="robots" content="noindex,follow,noarchive"/);
      assert.match(page,new RegExp('rel="canonical" href="https:\\/\\/audiotel-premium-pro\\.com\\/'+slug+'\\/"'));
      if(!legal){assert.match(page,/"@type":"WebPage"/);if(["monetiser-ses-appels","combien-rapporte-numero-surtaxe"].includes(slug))assert.match(page,/"@type":"Article"/);else assert.match(page,/"@type":"Service"/);}
      assert.doesNotMatch(page,/__CANONICAL__|__BASE__|__LOGO__/);
      assert.doesNotMatch(page,/audiotel-brand-icon-v33\.png"[^>]*alt=""/,"footer brand icon needs descriptive alt on "+slug);
      const scripts=[...page.matchAll(/<script[^>]+src="([^"]+)"/gi)].map(x=>x[1].split("?")[0]);
      const allowedScripts={
        "demande-ouverture":["/site/form-ux.js","/site/site.js","/site/hubspot-tracking.js","/site/contact-widget.js","/site/site-search.js","/site/footer-year.js","/site/share.js"],
        "retractation":["/site/hubspot-tracking.js","/assets/config.js","/assets/withdrawal.js","/site/contact-widget.js","/site/site-search.js","/site/footer-year.js","/site/share.js"]
      }[slug]||["/site/hubspot-tracking.js","/site/contact-widget.js","/site/site-search.js","/site/footer-year.js","/site/share.js"];
      for(const src of scripts)assert.ok(allowedScripts.includes(src),"unexpected public script on "+slug+": "+src);
      assert.ok(scripts.includes("/site/contact-widget.js"),"contact widget missing on "+slug);
      assert.ok(
        /href="\/site\/public-marketing\.css\?v=[a-z0-9._-]+"/i.test(page)||
        /href="\/site\/contact-widget\.css\?v=[a-z0-9._-]+"/i.test(page)||
        /href="\/site\/application-marketing\.css\?v=[a-z0-9._-]+"/i.test(page),
        "marketing CSS must be present on "+slug
      );
    });
    const independants=seoPages[seoSlugs.indexOf("audiotel-independants")];
    assert.match(independants,/avec ou sans SIRET/i);
    assert.match(independants,/"@type":"FAQPage"/);
    assert.match(independants,/"@type":"BreadcrumbList"/);
    assert.match(independants,/src="\/site\/hubspot-tracking\.js\?v=[a-z0-9._-]+"/i);
    const comparator=seoPages[seoSlugs.indexOf("comparateur-audiotel")];
    assert.match(comparator,/1 800 € \/ mois/);
    assert.match(comparator,/0,10 € \/ min/);
    assert.match(comparator,/"@type":"FAQPage"/);
    assert.match(comparator,/"@type":"BreadcrumbList"/);
    const guide=seoPages[seoSlugs.indexOf("guide-audiotel-sva")];
    assert.match(guide,/Qu’est-ce qu’Audiotel/);
    assert.match(guide,/"@type":"FAQPage"/);
    assert.match(guide,/"@type":"BreadcrumbList"/);
    assert.match(guide,/"@type":"Article"/);
    assert.doesNotMatch(guide,/"datePublished"|"dateModified"/);
    assert.match(guide,/"image":"https:\/\/audiotel-premium-pro\.com\/assets\/audiotel-brand-logo-v33\.png"/);
    assert.match(guide,/Arcep : numéros SVA/);
    assert.ok(guide.includes("economie.gouv.fr"));
    for(const slug of ["monetiser-ses-appels","combien-rapporte-numero-surtaxe"]){
      const article=seoPages[seoSlugs.indexOf(slug)];
      assert.doesNotMatch(article,/"datePublished"|"dateModified"/);
      assert.match(article,/"image":"https:\/\/audiotel-premium-pro\.com\/assets\/audiotel-brand-logo-v33\.png"/);
    }
    const application=seoPages[seoSlugs.indexOf("demande-ouverture")];
    assert.match(application,/id="order-form"/);
    assert.match(application,/src="\/site\/site\.js\?v=[a-z0-9._-]+"/i);
    assert.match(application,/Continuer vers l’espace sécurisé/);
    assert.match(application,/Demander mon numéro/);
    assert.doesNotMatch(application,/Demander mon numéro de numéro/);
    const privacy=seoPages[seoSlugs.indexOf("confidentialite")];
    const terms=seoPages[seoSlugs.indexOf("conditions-abonnement")];
    assert.match(privacy,/Données financières/);
    assert.match(privacy,/CNIL/);
    assert.match(terms,/4,90 € TTC par mois/);
    assert.match(terms,/Reversements/);
  }finally{
    fs.rmSync("dist",{recursive:true,force:true});
  }
});
