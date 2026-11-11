(function(){
  var R=document.documentElement;
  function snap(){
    var o={ passages: getComputedStyle(document.getElementById('passages')).fontSize };
    ['.now','.now-m','.fix','.fix-m'].forEach(function(s){
      o[s]=getComputedStyle(document.querySelector(s)).fontSize;
    });
    return o;
  }
  var out={};
  R.style.removeProperty('--dgu-font-scale');
  R.removeAttribute('data-dgu-font-scaled');
  out.T0_无变量=snap();
  R.style.setProperty('--dgu-font-scale','1');
  out.T1_变量为1=snap();
  R.setAttribute('data-dgu-font-scaled','');
  R.style.setProperty('--dgu-font-scale','1.5');
  out.T2_变量1p5_正文缩放=snap();
  return JSON.stringify(out,null,1);
})()