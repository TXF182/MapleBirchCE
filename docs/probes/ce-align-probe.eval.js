(function(){
  var R=document.documentElement;
  function snap(){
    var o={};
    ['r0','r1','r2','r3','r4'].forEach(function(id){
      var b=document.querySelector('#'+id+' button');
      var cs=getComputedStyle(b);
      o[id]={padding:cs.padding, minHeight:cs.minHeight};
    });
    return o;
  }
  var out={ noAttr: snap() };
  R.setAttribute('data-dgu-buttons-scaled','');
  R.style.setProperty('--dgu-button-scale','1.5');
  out.attr150 = snap();
  return JSON.stringify(out, null, 1);
})()