<?php
/**
 * admin.php — the admin shell. This was a static admin.html behind Apache
 * Basic Auth until 05.09.2026; lib/auth.php records why that had to go.
 *
 * Three jobs:
 *   1. gate everything behind the session login;
 *   2. hand out the private assets itself — src/admin.jsx and the two spend
 *      JSON files cannot check a PHP session on their own, so .htaccess denies
 *      them over HTTP and they are read from disk here instead;
 *   3. render the page.
 */
require_once __DIR__ . '/lib/auth.php';

$asset = (string)($_GET['asset'] ?? '');
if ($asset !== '') {
    auth_require_api();
    $map = [
        'jsx'     => ['src/admin.jsx',           'application/javascript; charset=utf-8'],
        'costs'   => ['data/story-costs.json',   'application/json; charset=utf-8'],
        'pricing' => ['data/model-pricing.json', 'application/json; charset=utf-8'],
    ];
    if (!isset($map[$asset])) { http_response_code(404); exit; }
    [$rel, $type] = $map[$asset];
    $path = __DIR__ . '/' . $rel;
    if (!is_file($path)) { http_response_code(404); exit; }
    header('Content-Type: ' . $type);
    header('Cache-Control: no-store, no-cache, must-revalidate, private');
    readfile($path);
    exit;
}

auth_require_page();
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Signa Admin</title>
<meta name="robots" content="noindex, nofollow" />

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Onest:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">

<style>
  :root{
    --black:#000; --paper:#FFFEF9; --red:#EB3300; --gray:#C8C9C7;
    --display:"Anton",sans-serif; --sans:"Onest",system-ui,sans-serif; --mono:"JetBrains Mono",ui-monospace,monospace;
  }
  *{ box-sizing:border-box; margin:0; padding:0;}
  body{
    background: var(--paper); color: var(--black);
    font-family: var(--sans); font-size: 14px; line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  a{ color: inherit;}
  .admin-wrap{ display: grid; grid-template-columns: 240px 1fr; min-height: 100vh;}
  
  /* Sidebar */
  .admin-side{
    background: var(--black); color: var(--paper);
    padding: 24px 20px;
    display: flex; flex-direction: column;
    position: sticky; top: 0; height: 100vh;
  }
  .admin-side .brand{
    font-family: var(--display); font-size: 28px; letter-spacing: -0.01em;
    text-transform: uppercase; margin-bottom: 4px;
  }
  .admin-side .brand .r{ color: var(--red);}
  .admin-side .sub{
    font-family: var(--mono); font-size: 10px; letter-spacing: .08em;
    color: rgba(255,254,249,.5); text-transform: uppercase; margin-bottom: 32px;
  }
  .tab-btn{
    appearance: none; border: none; background: transparent; color: rgba(255,254,249,.65);
    text-align: left; padding: 10px 12px; margin-bottom: 2px;
    font: inherit; cursor: pointer; border-radius: 6px;
    display: flex; justify-content: space-between; align-items: center;
    transition: background .15s, color .15s;
  }
  .tab-btn:hover{ color: var(--paper); background: rgba(255,254,249,.06);}
  .tab-btn.active{ background: var(--red); color: var(--paper);}
  .tab-btn .ix{ font-family: var(--mono); font-size: 10px; opacity: .6;}
  .admin-side .foot{
    margin-top: auto; padding-top: 24px;
    border-top: 1px solid rgba(255,254,249,.15);
    display: flex; flex-direction: column; gap: 8px;
  }
  .admin-side .foot a{
    font-family: var(--mono); font-size: 11px; letter-spacing: .06em;
    text-transform: uppercase; color: rgba(255,254,249,.65);
    text-decoration: none;
  }
  .admin-side .foot a:hover{ color: var(--paper);}

  /* Main */
  .admin-main{
    padding: 32px 40px;
    max-width: 960px;
  }
  .admin-head{
    display: flex; justify-content: space-between; align-items: baseline;
    padding-bottom: 16px; border-bottom: 1px solid rgba(0,0,0,.12);
    margin-bottom: 28px;
  }
  .admin-head h1{
    font-family: var(--display); font-size: 36px; letter-spacing: -0.02em;
    text-transform: uppercase; line-height: 1;
  }
  .admin-head h1 .r{ color: var(--red);}
  .admin-head .status{
    font-family: var(--mono); font-size: 11px; letter-spacing: .08em;
    text-transform: uppercase; color: rgba(0,0,0,.6);
  }
  .admin-head .status.dirty{ color: var(--red); font-weight: 600;}

  /* Actions bar */
  .actions-bar{
    position: sticky; top: 0; z-index: 10;
    background: rgba(255,254,249,.95); backdrop-filter: blur(8px);
    padding: 12px 0; margin: 0 -40px 24px; padding: 12px 40px;
    border-bottom: 1px solid rgba(0,0,0,.08);
    display: flex; gap: 8px; align-items: center;
  }
  .btn{
    font-family: var(--mono); font-size: 11px; letter-spacing: .08em;
    text-transform: uppercase; font-weight: 600;
    padding: 10px 16px; border-radius: 999px; border: 1.5px solid var(--black);
    background: var(--paper); color: var(--black); cursor: pointer;
    transition: background .15s, color .15s, transform .15s;
  }
  .btn:hover{ background: var(--black); color: var(--paper);}
  .btn:active{ transform: scale(0.98);}
  .btn.primary{ background: var(--red); color: var(--paper); border-color: var(--red);}
  .btn.primary:hover{ background: var(--black); border-color: var(--black);}
  .btn.ghost{ border-color: transparent; color: rgba(0,0,0,.55);}
  .btn.ghost:hover{ background: rgba(0,0,0,.06); color: var(--black);}
  .btn:disabled{ opacity: 0.4; cursor: not-allowed;}
  .btn.translate{
    background: linear-gradient(95deg, #10a37f 0%, #1cb98e 100%);
    color: #fff; border-color: #10a37f;
  }
  .btn.translate:hover{ background: var(--black); border-color: var(--black);}

  /* Analytics */
  .analytics-h3{
    font-family: var(--display); font-size: 18px; text-transform: uppercase;
    letter-spacing: 0; margin: 28px 0 10px;
  }
  .kpi-card{
    background: var(--paper);
    border: 1px solid rgba(0,0,0,.12);
    border-radius: 12px;
    padding: 16px 18px;
  }
  .kpi-label{
    font-family: var(--mono); font-size: 10px; letter-spacing: .08em;
    text-transform: uppercase; color: rgba(0,0,0,.55);
  }
  .kpi-value{
    font-family: var(--display); font-size: 36px; line-height: 1;
    color: var(--black); margin-top: 4px;
  }
  .kpi-sub{
    font-family: var(--mono); font-size: 10px;
    color: rgba(0,0,0,.4); margin-top: 4px;
  }
  .stat-bar{
    display: grid;
    grid-template-columns: minmax(140px, 30%) 1fr 80px;
    gap: 12px; align-items: center;
    padding: 6px 0;
  }
  .stat-bar-label{
    font-family: var(--mono); font-size: 11px; letter-spacing: .04em;
    color: rgba(0,0,0,.7);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .stat-bar-track{
    height: 10px; background: rgba(0,0,0,.06);
    border-radius: 999px; overflow: hidden;
  }
  .stat-bar-fill{
    height: 100%; background: linear-gradient(90deg, var(--red) 0%, #ff7f50 100%);
    border-radius: 999px;
  }
  .stat-bar-value{
    font-family: var(--mono); font-size: 11px;
    color: rgba(0,0,0,.7);
    text-align: right;
  }

  /* Translation progress */
  .tr-progress{
    margin: -16px 0 24px;
    padding: 12px 16px;
    background: rgba(16,163,127,.08);
    border: 1px solid rgba(16,163,127,.25);
    border-radius: 10px;
  }
  .tr-progress-bar{
    height: 6px; background: rgba(0,0,0,.08); border-radius: 999px; overflow: hidden;
  }
  .tr-progress-fill{
    height: 100%;
    background: linear-gradient(90deg, #10a37f 0%, #1cb98e 100%);
    transition: width .3s ease;
  }
  .tr-progress-msg{
    margin-top: 8px;
    font-family: var(--mono); font-size: 11px;
    color: rgba(0,0,0,.7);
  }

  /* Cards / forms */
  .card{
    border: 1px solid rgba(0,0,0,.12);
    border-radius: 12px; background: var(--paper);
    padding: 18px 20px;
    margin-bottom: 12px;
    display: grid; gap: 10px;
  }
  .card.dragging{ opacity: .5;}
  .card .row{ display: grid; gap: 6px;}
  .card .row.cols-2{ grid-template-columns: 1fr 1fr; gap: 12px;}
  .card .row.cols-3{ grid-template-columns: 1fr 1fr 1fr; gap: 12px;}
  .card label{
    font-family: var(--mono); font-size: 10px; letter-spacing: .08em;
    text-transform: uppercase; color: rgba(0,0,0,.55);
  }
  .card input[type="text"],
  .card input[type="number"],
  .card input[type="url"],
  .card input[type="email"],
  .card input[type="tel"],
  .card textarea,
  .card select{
    font: inherit;
    padding: 8px 12px;
    border: 1px solid rgba(0,0,0,.18);
    border-radius: 6px;
    background: var(--paper);
    color: var(--black);
    width: 100%;
    outline: none;
    transition: border-color .15s;
  }
  .card textarea{ min-height: 60px; resize: vertical; line-height: 1.5;}
  .card input:focus, .card textarea:focus, .card select:focus{
    border-color: var(--black);
  }
  .card .head{
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 4px;
  }
  .card .head .num{
    font-family: var(--display); font-size: 22px;
    letter-spacing: -0.01em; color: rgba(0,0,0,.4);
  }
  .card .head .ctrls{
    display: flex; gap: 4px;
  }
  .icon-btn{
    width: 28px; height: 28px;
    border: none; background: transparent; color: rgba(0,0,0,.5);
    border-radius: 4px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 16px; line-height: 1;
  }
  .icon-btn:hover{ background: rgba(0,0,0,.08); color: var(--black);}
  .icon-btn.danger:hover{ background: rgba(235,51,0,.1); color: var(--red);}

  .add-card{
    border: 1.5px dashed rgba(0,0,0,.25);
    border-radius: 12px;
    padding: 18px; text-align: center;
    color: rgba(0,0,0,.55); cursor: pointer;
    font-family: var(--mono); font-size: 11px; letter-spacing: .08em;
    text-transform: uppercase;
    background: transparent;
    width: 100%;
    transition: border-color .15s, color .15s;
  }
  .add-card:hover{ border-color: var(--red); color: var(--red);}

  /* Photo gallery */
  .photo-grid{
    display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
  .photo-tile{
    position: relative;
    aspect-ratio: 1; border-radius: 8px; overflow: hidden;
    background: rgba(0,0,0,.05);
    border: 1px solid rgba(0,0,0,.1);
  }
  .photo-tile img{
    width: 100%; height: 100%; object-fit: cover; display: block;
  }
  .photo-tile .name{
    position: absolute; left: 4px; bottom: 4px; right: 4px;
    font-family: var(--mono); font-size: 9px; letter-spacing: .04em;
    color: var(--paper); background: rgba(0,0,0,.7);
    padding: 3px 6px; border-radius: 3px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* Inline content tab styles */
  .field-group{
    border-top: 1px solid rgba(0,0,0,.08);
    padding-top: 20px; margin-top: 20px;
  }
  .field-group h3{
    font-family: var(--display); font-size: 18px;
    letter-spacing: -0.01em; text-transform: uppercase;
    margin-bottom: 14px;
  }

  /* Notes */
  .note{
    background: rgba(235,51,0,.06);
    border-left: 3px solid var(--red);
    padding: 12px 14px; border-radius: 4px;
    font-size: 13px; line-height: 1.5;
    margin-bottom: 16px;
  }
  .note b{ color: var(--red);}
  .note code{
    font-family: var(--mono); font-size: 11px;
    background: rgba(0,0,0,.07); padding: 1px 5px; border-radius: 3px;
  }

  /* Tag pills */
  .tag-list{ display: flex; gap: 6px; flex-wrap: wrap;}
  .tag-pill{
    font-family: var(--mono); font-size: 10px; letter-spacing: .06em;
    text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px;
    background: rgba(0,0,0,.06); color: rgba(0,0,0,.65);
    cursor: pointer; border: 1px solid transparent;
  }
  .tag-pill.active{ background: var(--black); color: var(--paper);}

  /* Image picker UI */
  .image-picker-stage{
    display: grid; gap: 10px;
  }
  .image-preview{
    position: relative;
    width: 100%; height: 180px;
    background: rgba(0,0,0,.04);
    border: 1.5px dashed rgba(0,0,0,.18);
    border-radius: 10px;
    cursor: pointer;
    overflow: hidden;
    transition: border-color .15s, background .15s;
    display: flex; align-items: center; justify-content: center;
  }
  .image-preview:hover{ border-color: var(--red);}
  .image-preview img{
    width: 100%; height: 100%; object-fit: cover; display: block;
  }
  .image-preview .image-preview-empty{
    font-family: var(--mono); font-size: 11px;
    letter-spacing: .08em; text-transform: uppercase;
    color: rgba(0,0,0,.4);
  }
  .image-preview .image-overlay{
    position: absolute; left: 8px; bottom: 8px;
    font-family: var(--mono); font-size: 10px;
    background: rgba(0,0,0,.7); color: var(--paper);
    padding: 4px 8px; border-radius: 4px;
    letter-spacing: .06em; text-transform: uppercase;
    opacity: 0; transition: opacity .2s;
  }
  .image-preview:hover .image-overlay{ opacity: 1;}
  .image-controls{
    display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
  }
  .image-controls .btn{ padding: 6px 12px; font-size: 10px;}
  .image-path-hint{
    font-family: var(--mono); font-size: 10px;
    color: rgba(0,0,0,.5);
    letter-spacing: .04em;
    margin-left: auto;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 200px;
  }
  .image-gallery{
    margin-top: 4px;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 4px;
    padding: 10px;
    background: rgba(0,0,0,.04);
    border-radius: 8px;
    max-height: 280px; overflow-y: auto;
  }
  .gallery-tile{
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    background: rgba(0,0,0,.08);
    padding: 0;
    transition: border-color .15s, transform .15s;
  }
  .gallery-tile:hover{ transform: scale(1.05);}
  .gallery-tile.active{ border-color: var(--red);}
  .gallery-tile img{ width: 100%; height: 100%; object-fit: cover; display: block;}
  .image-empty-hint{
    grid-column: 1 / -1;
    text-align: center;
    font-family: var(--mono); font-size: 11px;
    color: rgba(0,0,0,.5);
    padding: 14px;
  }

  /* Login gate */
  .login-gate{
    min-height: 100vh;
    display: grid; place-items: center;
    background: var(--black);
    padding: 24px;
  }
  .login-card{
    background: var(--paper);
    border-radius: 14px;
    padding: 36px 32px 32px;
    width: 100%; max-width: 360px;
    display: flex; flex-direction: column; gap: 14px;
    box-shadow: 0 24px 60px rgba(0,0,0,.4);
  }
  .login-brand{
    font-family: var(--display);
    font-size: 44px; letter-spacing: -0.02em;
    text-transform: uppercase; line-height: 1;
  }
  .login-sub{
    font-family: var(--mono); font-size: 10px;
    letter-spacing: .08em; text-transform: uppercase;
    color: rgba(0,0,0,.55);
    margin-bottom: 8px;
  }
  .login-card input{
    font: inherit; font-size: 15px;
    padding: 14px 16px;
    border: 1.5px solid rgba(0,0,0,.2);
    border-radius: 8px;
    background: var(--paper);
    color: var(--black);
    outline: none;
    transition: border-color .15s;
  }
  .login-card input:focus{ border-color: var(--black);}
  .login-err{
    font-family: var(--mono); font-size: 11px;
    letter-spacing: .06em; text-transform: uppercase;
    color: var(--red);
  }
  .login-card .btn{
    margin-top: 4px;
    padding: 14px 22px;
    font-size: 12px;
  }

  @media (max-width: 720px){
    .admin-wrap{ grid-template-columns: 1fr;}
    .admin-side{ position: static; height: auto; flex-direction: row;
      flex-wrap: wrap; gap: 4px; padding: 14px; align-items: center;}
    .admin-side .brand{ font-size: 22px; margin: 0;}
    .admin-side .sub, .admin-side .foot{ display: none;}
    .tab-btn{ flex: 0 0 auto; padding: 6px 10px; font-size: 12px; margin: 0;}
    .admin-main{ padding: 20px;}
    .actions-bar{ margin: 0 -20px 20px; padding: 12px 20px;}
    .card .row.cols-2{ grid-template-columns: 1fr;}
    .card .row.cols-3{ grid-template-columns: 1fr;}
  }
</style>

<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>
</head>
<body>
<div id="root"></div>
<script type="text/babel" src="admin.php?asset=jsx&amp;v=20260905a"></script>
</body>
</html>
