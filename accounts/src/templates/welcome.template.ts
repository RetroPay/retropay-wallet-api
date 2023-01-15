const welcomeEmail = function (firstname: string) {
    const html = `
    <!doctype html>
    <html ⚡4email data-css-strict>
     <head><meta charset="utf-8"><style amp4email-boilerplate>body{visibility:hidden}</style><script async src="https://cdn.ampproject.org/v0.js"></script>
      
      <style amp-custom>
    .es-desk-hidden {
        display:none;
        float:left;
        overflow:hidden;
        width:0;
        max-height:0;
        line-height:0;
    }
    body {
        width:100%;
        font-family:arial, "helvetica neue", helvetica, sans-serif;
    }
    table {
        border-collapse:collapse;
        border-spacing:0px;
    }
    table td, body, .es-wrapper {
        padding:0;
        Margin:0;
    }
    .es-content, .es-header, .es-footer {
        table-layout:fixed;
        width:100%;
    }
    p, hr {
        Margin:0;
    }
    h1, h2, h3, h4, h5 {
        Margin:0;
        line-height:120%;
        font-family:lato, "helvetica neue", helvetica, arial, sans-serif;
    }
    .es-left {
        float:left;
    }
    .es-right {
        float:right;
    }
    .es-p5 {
        padding:5px;
    }
    .es-p5t {
        padding-top:5px;
    }
    .es-p5b {
        padding-bottom:5px;
    }
    .es-p5l {
        padding-left:5px;
    }
    .es-p5r {
        padding-right:5px;
    }
    .es-p10 {
        padding:10px;
    }
    .es-p10t {
        padding-top:10px;
    }
    .es-p10b {
        padding-bottom:10px;
    }
    .es-p10l {
        padding-left:10px;
    }
    .es-p10r {
        padding-right:10px;
    }
    .es-p15 {
        padding:15px;
    }
    .es-p15t {
        padding-top:15px;
    }
    .es-p15b {
        padding-bottom:15px;
    }
    .es-p15l {
        padding-left:15px;
    }
    .es-p15r {
        padding-right:15px;
    }
    .es-p20 {
        padding:20px;
    }
    .es-p20t {
        padding-top:20px;
    }
    .es-p20b {
        padding-bottom:20px;
    }
    .es-p20l {
        padding-left:20px;
    }
    .es-p20r {
        padding-right:20px;
    }
    .es-p25 {
        padding:25px;
    }
    .es-p25t {
        padding-top:25px;
    }
    .es-p25b {
        padding-bottom:25px;
    }
    .es-p25l {
        padding-left:25px;
    }
    .es-p25r {
        padding-right:25px;
    }
    .es-p30 {
        padding:30px;
    }
    .es-p30t {
        padding-top:30px;
    }
    .es-p30b {
        padding-bottom:30px;
    }
    .es-p30l {
        padding-left:30px;
    }
    .es-p30r {
        padding-right:30px;
    }
    .es-p35 {
        padding:35px;
    }
    .es-p35t {
        padding-top:35px;
    }
    .es-p35b {
        padding-bottom:35px;
    }
    .es-p35l {
        padding-left:35px;
    }
    .es-p35r {
        padding-right:35px;
    }
    .es-p40 {
        padding:40px;
    }
    .es-p40t {
        padding-top:40px;
    }
    .es-p40b {
        padding-bottom:40px;
    }
    .es-p40l {
        padding-left:40px;
    }
    .es-p40r {
        padding-right:40px;
    }
    .es-menu td {
        border:0;
    }
    s {
        text-decoration:line-through;
    }
    p, ul li, ol li {
        font-family:lato, "helvetica neue", helvetica, arial, sans-serif;
        line-height:150%;
    }
    ul li, ol li {
        Margin-bottom:15px;
        margin-left:0;
    }
    a {
        text-decoration:none;
    }
    .es-menu td a {
        text-decoration:none;
        display:block;
        font-family:lato, "helvetica neue", helvetica, arial, sans-serif;
    }
    .es-menu amp-img, .es-button amp-img {
        vertical-align:middle;
    }
    .es-wrapper {
        width:100%;
        height:100%;
    }
    .es-wrapper-color, .es-wrapper {
        background-color:#F0F0F0;
    }
    .es-header {
        background-color:transparent;
    }
    .es-header-body {
        background-color:#FFFFFF;
    }
    .es-header-body p, .es-header-body ul li, .es-header-body ol li {
        color:#333333;
        font-size:14px;
    }
    .es-header-body a {
        color:#2CB543;
        font-size:14px;
    }
    .es-content-body {
        background-color:#FFFFFF;
    }
    .es-content-body p, .es-content-body ul li, .es-content-body ol li {
        color:#666666;
        font-size:18px;
    }
    .es-content-body a {
        color:#555555;
        font-size:18px;
    }
    .es-footer {
        background-color:transparent;
    }
    .es-footer-body {
        background-color:#A1A1A2;
    }
    .es-footer-body p, .es-footer-body ul li, .es-footer-body ol li {
        color:#EFEFEF;
        font-size:14px;
    }
    .es-footer-body a {
        color:#EFEFEF;
        font-size:14px;
    }
    .es-infoblock, .es-infoblock p, .es-infoblock ul li, .es-infoblock ol li {
        line-height:120%;
        font-size:12px;
        color:#CCCCCC;
    }
    .es-infoblock a {
        font-size:12px;
        color:#CCCCCC;
    }
    h1 {
        font-size:30px;
        font-style:normal;
        font-weight:bold;
        color:#262E3A;
    }
    h2 {
        font-size:22px;
        font-style:normal;
        font-weight:bold;
        color:#262E3A;
    }
    h3 {
        font-size:18px;
        font-style:normal;
        font-weight:bold;
        color:#262E3A;
    }
    .es-header-body h1 a, .es-content-body h1 a, .es-footer-body h1 a {
        font-size:30px;
    }
    .es-header-body h2 a, .es-content-body h2 a, .es-footer-body h2 a {
        font-size:22px;
    }
    .es-header-body h3 a, .es-content-body h3 a, .es-footer-body h3 a {
        font-size:18px;
    }
    a.es-button, button.es-button {
        border-style:solid;
        border-color:#FF6600;
        border-width:15px 40px 15px 40px;
        display:inline-block;
        background:#FF6600;
        border-radius:0px;
        font-size:18px;
        font-family:lato, "helvetica neue", helvetica, arial, sans-serif;
        font-weight:bold;
        font-style:normal;
        line-height:120%;
        color:#FFFFFF;
        text-decoration:none;
        width:auto;
        text-align:center;
    }
    .es-button-border {
        border-style:solid solid solid solid;
        border-color:#2CB543 #2CB543 #2CB543 #2CB543;
        background:#FF6600;
        border-width:0px 0px 0px 0px;
        display:inline-block;
        border-radius:0px;
        width:auto;
    }
    .es-button img {
        display:inline-block;
        vertical-align:middle;
    }
    body {
        font-family:lato, "helvetica neue", helvetica, arial, sans-serif;
    }
    @media only screen and (max-width:600px) {p, ul li, ol li, a { line-height:150% } h1, h2, h3, h1 a, h2 a, h3 a { line-height:120% } h1 { font-size:30px; text-align:left } h2 { font-size:24px; text-align:left } h3 { font-size:20px; text-align:left } .es-header-body h1 a, .es-content-body h1 a, .es-footer-body h1 a { font-size:30px; text-align:left } .es-header-body h2 a, .es-content-body h2 a, .es-footer-body h2 a { font-size:24px; text-align:left } .es-header-body h3 a, .es-content-body h3 a, .es-footer-body h3 a { font-size:20px; text-align:left } .es-menu td a { font-size:14px } .es-header-body p, .es-header-body ul li, .es-header-body ol li, .es-header-body a { font-size:14px } .es-content-body p, .es-content-body ul li, .es-content-body ol li, .es-content-body a { font-size:14px } .es-footer-body p, .es-footer-body ul li, .es-footer-body ol li, .es-footer-body a { font-size:14px } .es-infoblock p, .es-infoblock ul li, .es-infoblock ol li, .es-infoblock a { font-size:12px } *[class="gmail-fix"] { display:none } .es-m-txt-c, .es-m-txt-c h1, .es-m-txt-c h2, .es-m-txt-c h3 { text-align:center } .es-m-txt-r, .es-m-txt-r h1, .es-m-txt-r h2, .es-m-txt-r h3 { text-align:right } .es-m-txt-l, .es-m-txt-l h1, .es-m-txt-l h2, .es-m-txt-l h3 { text-align:left } .es-m-txt-r amp-img { float:right } .es-m-txt-c amp-img { margin:0 auto } .es-m-txt-l amp-img { float:left } .es-button-border { display:inline-block } a.es-button, button.es-button { font-size:18px; display:inline-block } .es-adaptive table, .es-left, .es-right { width:100% } .es-content table, .es-header table, .es-footer table, .es-content, .es-footer, .es-header { width:100%; max-width:600px } .es-adapt-td { display:block; width:100% } .adapt-img { width:100%; height:auto } td.es-m-p0 { padding:0 } td.es-m-p0r { padding-right:0 } td.es-m-p0l { padding-left:0 } td.es-m-p0t { padding-top:0 } td.es-m-p0b { padding-bottom:0 } td.es-m-p20b { padding-bottom:20px } .es-mobile-hidden, .es-hidden { display:none } tr.es-desk-hidden, td.es-desk-hidden, table.es-desk-hidden { width:auto; overflow:visible; float:none; max-height:inherit; line-height:inherit } tr.es-desk-hidden { display:table-row } table.es-desk-hidden { display:table } td.es-desk-menu-hidden { display:table-cell } .es-menu td { width:1% } table.es-table-not-adapt, .esd-block-html table { width:auto } table.es-social { display:inline-block } table.es-social td { display:inline-block } td.es-m-p5 { padding:5px } td.es-m-p5t { padding-top:5px } td.es-m-p5b { padding-bottom:5px } td.es-m-p5r { padding-right:5px } td.es-m-p5l { padding-left:5px } td.es-m-p10 { padding:10px } td.es-m-p10t { padding-top:10px } td.es-m-p10b { padding-bottom:10px } td.es-m-p10r { padding-right:10px } td.es-m-p10l { padding-left:10px } td.es-m-p15 { padding:15px } td.es-m-p15t { padding-top:15px } td.es-m-p15b { padding-bottom:15px } td.es-m-p15r { padding-right:15px } td.es-m-p15l { padding-left:15px } td.es-m-p20 { padding:20px } td.es-m-p20t { padding-top:20px } td.es-m-p20r { padding-right:20px } td.es-m-p20l { padding-left:20px } td.es-m-p25 { padding:25px } td.es-m-p25t { padding-top:25px } td.es-m-p25b { padding-bottom:25px } td.es-m-p25r { padding-right:25px } td.es-m-p25l { padding-left:25px } td.es-m-p30 { padding:30px } td.es-m-p30t { padding-top:30px } td.es-m-p30b { padding-bottom:30px } td.es-m-p30r { padding-right:30px } td.es-m-p30l { padding-left:30px } td.es-m-p35 { padding:35px } td.es-m-p35t { padding-top:35px } td.es-m-p35b { padding-bottom:35px } td.es-m-p35r { padding-right:35px } td.es-m-p35l { padding-left:35px } td.es-m-p40 { padding:40px } td.es-m-p40t { padding-top:40px } td.es-m-p40b { padding-bottom:40px } td.es-m-p40r { padding-right:40px } td.es-m-p40l { padding-left:40px } .es-desk-hidden { display:table-row; width:auto; overflow:visible; max-height:inherit } }
    </style>
     </head>
     <body>
      <div class="es-wrapper-color">
       <!--[if gte mso 9]>
                <v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
                    <v:fill type="tile" color="#F0F0F0"></v:fill>
                </v:background>
            <![endif]-->
       <table class="es-wrapper" width="100%" cellspacing="0" cellpadding="0">
         <tr>
          <td valign="top">
           <table cellpadding="0" cellspacing="0" class="es-header" align="center">
             <tr>
              <td align="center">
               <table bgcolor="#ffffff" class="es-header-body" align="center" cellpadding="0" cellspacing="0" width="600">
                 <tr>
                  <td class="esdev-adapt-off es-p20l" align="left">
                   <!--[if mso]><table width="580" cellpadding="0" cellspacing="0"><tr><td width="170" valign="top"><![endif]-->
                   <table cellpadding="0" cellspacing="0" align="left" class="es-left">
                     <tr>
                      <td width="170" class="es-m-p0r es-m-p20b" valign="top" align="center">
                       <table cellpadding="0" cellspacing="0" width="100%" role="presentation">
                         <tr>
                          <td align="center" class="es-p20t es-p20b" style="font-size: 0px"><a target="_blank" href="https://viewstripo.email"><amp-img src="https://jhfekz.stripocdn.email/content/guids/CABINET_2b068280ebfc2d54ae1c3614324c566f2b59bea83072dd6913b0213bd1770318/images/logo_inner_shadow.png" alt="Logo" style="display: block" title="Logo" class="adapt-img" height="155" width="155" layout="responsive"></amp-img></a></td>
                         </tr>
                         <tr class="es-mobile-hidden">
                          <td align="center" height="59"></td>
                         </tr>
                         <tr>
                          <td align="left"><h1 style="font-size: 27px">Howdy, ${firstname}!</h1></td>
                         </tr>
                       </table></td>
                     </tr>
                   </table> 
                   <!--[if mso]></td><td width="20"></td><td width="390" valign="top"><![endif]-->
                   <table cellpadding="0" cellspacing="0" class="es-right" align="right">
                     <tr class="es-mobile-hidden">
                      <td width="390" align="left">
                       <table cellpadding="0" cellspacing="0" width="100%" role="presentation">
                         <tr>
                          <td align="center" style="font-size: 0px"><a target="_blank" href="https://viewstripo.email"><amp-img class="adapt-img" src="https://jhfekz.stripocdn.email/content/guids/CABINET_cb2be5825fa5d03154dd7b2a9d321a1f/images/34915783_8240719_2_OhJ.png" alt style="display: block" width="365" height="321" layout="responsive"></amp-img></a></td>
                         </tr>
                       </table></td>
                     </tr>
                   </table> 
                   <!--[if mso]></td></tr></table><![endif]--></td>
                 </tr>
               </table></td>
             </tr>
           </table>
           <table cellpadding="0" cellspacing="0" class="es-content" align="center">
             <tr>
              <td align="center">
               <table bgcolor="#ffffff" class="es-content-body" align="center" cellpadding="0" cellspacing="0" width="600">
                 <tr>
                  <td class="esdev-adapt-off es-p40t es-p20b es-p20r es-p20l" align="left">
                   <table cellpadding="0" cellspacing="0" width="100%">
                     <tr>
                      <td width="560" align="left">
                       <table cellpadding="0" cellspacing="0" width="100%" role="presentation">
                         <tr>
                          <td align="left" class="es-p10t"><h2 style="text-align: center">SEND &amp; RECEIVE MONEY THE RETRO WAY</h2></td>
                         </tr>
                       </table></td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>
           </table>
           <table class="es-content" cellspacing="0" cellpadding="0" align="center">
             <tr>
              <td align="center">
               <table class="es-content-body" style="background-color: #ffffff" width="600" cellspacing="0" cellpadding="0" bgcolor="#ffffff" align="center">
                 <tr>
                  <td class="es-p20r es-p20l" align="left" bgcolor="#ffffff" style="background-color: #ffffff">
                   <table cellpadding="0" cellspacing="0" width="100%">
                     <tr>
                      <td width="560" align="left">
                       <table cellpadding="0" cellspacing="0" width="100%" role="presentation">
                         <tr>
                          <td align="left" class="es-p25t es-p20b"><p style="font-family: 'open sans', 'helvetica neue', helvetica, arial, sans-serif;font-size: 17px;color: #000000">We are excited to have you join our community of users who are experiencing the thrill of swift and secure fund transfers.</p></td>
                         </tr>
                       </table></td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>
           </table>
           <table cellpadding="0" cellspacing="0" class="es-content" align="center">
             <tr>
              <td align="center">
               <table bgcolor="#ffffff" class="es-content-body" align="center" cellpadding="0" cellspacing="0" width="600">
                 <tr>
                  <td class="es-p20" align="left" bgcolor="#ffffff" style="background-color: #ffffff">
                   <table cellpadding="0" cellspacing="0" width="100%">
                     <tr>
                      <td width="560" align="center" valign="top">
                       <table cellpadding="0" cellspacing="0" width="100%" role="presentation">
                         <tr>
                          <td align="left"><p style="color: #000000;font-size: 17px;font-family: 'open sans', 'helvetica neue', helvetica, arial, sans-serif"><span style="font-size:16px">With Retro Wallet, you'll be able to send and receive money from friends, family, and other users, all with just a few simple taps without hassle. Send funds via account tags and worry less about account numbers. Fund your wallet to get started exploring&nbsp;right away!<br><br>We have exciting new features and promotions in the works that we can't wait to share with you. We hope you find them full of value and enjoy them as much as we do building them.<br><br>Welcome aboard!<br><strong>Retro&nbsp;Wallet Team.</strong></span><br><strong><span style="font-size:14px">#PayWithRetro #PayTheRetroWay #RetroFunds</span></strong><br><br></p></td>
                         </tr>
                       </table></td>
                     </tr>
                   </table></td>
                 </tr>
                 <tr>
                  <td class="es-p20t es-p20r es-p20l" style="background-color: #511291;background-image: url(https://jhfekz.stripocdn.email/content/guids/CABINET_2b068280ebfc2d54ae1c3614324c566f2b59bea83072dd6913b0213bd1770318/images/bookmark_instagram_post_square.png);background-repeat: no-repeat;background-position: left top" bgcolor="#511291" align="left">
                   <!--[if mso]><table width="560" cellpadding="0" cellspacing="0"><tr><td width="270" valign="top"><![endif]-->
                   <table class="es-left" cellspacing="0" cellpadding="0" align="left">
                     <tr>
                      <td width="270" valign="top" align="center">
                       <table style="background-position: center top" width="100%" cellspacing="0" cellpadding="0" role="presentation">
                         <tr>
                          <td class="es-p10t" align="left"><h4 style="color: #ffffff;font-size: 21px">Follow Us.</h4></td>
                         </tr>
                         <tr>
                          <td class="es-p5t" align="left"><p style="color: #efefef;font-size: 16px">Connect with us on our socials</p></td>
                         </tr>
                         <tr>
                          <td class="es-p20t es-p30b" align="left" style="font-size: 0px">
                           <table class="es-table-not-adapt es-social" cellspacing="0" cellpadding="0" role="presentation">
                             <tr>
                              <td class="es-p10r" valign="top" align="center"><a target="_blank" href="https://twitter.com/retrostackhq"><amp-img title="Twitter" src="https://jhfekz.stripocdn.email/content/assets/img/social-icons/rounded-colored-bordered/twitter-rounded-colored-bordered.png" alt="Tw" width="32" height="32"></amp-img></a></td>
                              <td valign="top" align="center" class="es-p10r"><amp-img title="Youtube" src="https://jhfekz.stripocdn.email/content/assets/img/social-icons/rounded-colored-bordered/youtube-rounded-colored-bordered.png" alt="Yt" width="32" height="32"></amp-img></td>
                              <td valign="top" align="center"><a target="_blank" href="https://www.linkedin.com/company/retrostack/"><amp-img title="Linkedin" src="https://jhfekz.stripocdn.email/content/assets/img/social-icons/rounded-colored-bordered/linkedin-rounded-colored-bordered.png" alt="In" width="32" height="32"></amp-img></a></td>
                             </tr>
                           </table></td>
                         </tr>
                         <tr>
                          <td align="left"><h4 style="color: #ffffff;font-size: 21px">Contact Us.</h4></td>
                         </tr>
                         <tr>
                          <td class="es-p5t" align="left"><p style="color: #efefef;font-size: 16px">Reach out to our support team.</p></td>
                         </tr>
                         <tr>
                          <td class="es-p10t es-p20b" align="left"><p style="color: #00ce8d;font-size: 16px">support<a target="_blank" href="mailto:support@retropay.app" style="font-size: 16px;color: #00ce8d;text-decoration: none">@retropay.a</a>pp</p></td>
                         </tr>
                       </table></td>
                     </tr>
                   </table> 
                   <!--[if mso]></td><td width="20"></td><td width="270" valign="top"><![endif]-->
                   <table class="es-right" cellspacing="0" cellpadding="0" align="right">
                     <tr>
                      <td width="270" align="left">
                       <table style="background-position: center top" width="100%" cellspacing="0" cellpadding="0" role="presentation">
                         <tr class="es-mobile-hidden">
                          <td height="17" align="center"></td>
                         </tr>
                       </table></td>
                     </tr>
                   </table> 
                   <!--[if mso]></td></tr></table><![endif]--></td>
                 </tr>
               </table></td>
             </tr>
           </table>
           <table cellpadding="0" cellspacing="0" class="es-footer" align="center">
             <tr>
              <td align="center">
               <table class="es-footer-body" align="center" cellpadding="0" cellspacing="0" width="600" style="background-color: transparent">
                 <tr>
                  <td class="es-p20t es-p20b es-p20r es-p20l" align="left" bgcolor="#ffffff" style="background-color: #ffffff">
                   <table cellpadding="0" cellspacing="0" width="100%">
                     <tr>
                      <td width="560" align="left">
                       <table cellpadding="0" cellspacing="0" width="100%" role="presentation">
                         <tr>
                          <td align="center" class="es-p30b"><p style="color: #666666">Retro Wallet © ${(new Date).getFullYear()}. All rights reserved<br>Built by&nbsp;by&nbsp;<strong>Retrostack Technologies</strong></p></td>
                         </tr>
                         <tr>
                          <td>
                           <table cellpadding="0" cellspacing="0" width="100%" class="es-menu" role="presentation">
                             <tr class="links">
                              <td align="center" valign="top" width="33.33%" class="es-p10t es-p10b es-p5r es-p5l" style="padding-top: 5px;padding-bottom: 5px"><a target="_blank" href="link-here" style="color: #666666">Visit Us </a></td>
                              <td align="center" valign="top" width="33.33%" class="es-p10t es-p10b es-p5r es-p5l" style="padding-top: 5px;padding-bottom: 5px;border-left: 1px solid #cccccc"><a target="_blank" href="link-here" style="color: #666666">Privacy Policy</a></td>
                              <td align="center" valign="top" width="33.33%" class="es-p10t es-p10b es-p5r es-p5l" style="padding-top: 5px;padding-bottom: 5px;border-left: 1px solid #cccccc"><a target="_blank" href="link-here" style="color: #666666">Terms of Use</a></td>
                             </tr>
                           </table></td>
                         </tr>
                       </table></td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>
           </table></td>
         </tr>
       </table>
      </div>
     </body>
    </html>
    `;
    const text = `
        Welcome to Retro Wallet ${firstname}, you're one step closer to experiencing a modern world of personal finance. Here are few things to help you get started!`;
    return {
        html: html,
        text: text,
    };
};

export default welcomeEmail;