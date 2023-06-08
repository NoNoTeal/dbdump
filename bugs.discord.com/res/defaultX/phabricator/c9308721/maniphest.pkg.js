JX.behavior('maniphest-batch-selector',function(config){var
selected={};var
get_id=function(task){return JX.Stratcom.getData(task).taskID;};var
is_selected=function(task){return(get_id(task)in
selected);};var
change=function(task,to){if(to===undefined){to=!is_selected(task);}if(to){selected[get_id(task)]=true;}else{delete
selected[get_id(task)];}JX.DOM.alterClass(task,'phui-oi-selected',is_selected(task));update();};var
changeall=function(to){var
inputs=JX.DOM.scry(document.body,'li','maniphest-task');for(var
ii=0;ii<inputs.length;ii++){change(inputs[ii],to);}};var
clear_selection=function(){if(window.getSelection){if(window.getSelection().empty){window.getSelection().empty();}else
if(window.getSelection().removeAllRanges){window.getSelection().removeAllRanges();}}else
if(document.selection){document.selection.empty();}};var
update=function(){var
count=JX.keys(selected).length;var
status;if(count===0){status='Shift-Click to Select Tasks';}else
if(status==1){status='1 Selected Task';}else{status=count+' Selected Tasks';}JX.DOM.setContent(JX.$(config.status),status);var
submit=JX.$(config.submit);var
disable=(count===0);submit.disabled=disable;JX.DOM.alterClass(submit,'disabled',disable);};JX.Stratcom.listen('click','maniphest-task',function(e){var
raw=e.getRawEvent();if(!raw.shiftKey){return;}if(raw.ctrlKey||raw.altKey||raw.metaKey||e.isRightButton()){return;}if(JX.Stratcom.pass(e)){return;}e.kill();change(e.getNode('maniphest-task'));clear_selection();});JX.DOM.listen(JX.$(config.selectNone),'click',null,function(e){changeall(false);e.kill();});JX.DOM.listen(JX.$(config.selectAll),'click',null,function(e){changeall(true);e.kill();});JX.DOM.listen(JX.$(config.formID),'submit',null,function(){var
ids=[];for(var
k
in
selected){ids.push(k);}ids=ids.join(',');var
input=JX.$N('input',{type:'hidden',name:'ids',value:ids});JX.DOM.setContent(JX.$(config.idContainer),input);});update();});JX.behavior('maniphest-list-editor',function(){var
onedit=function(task,r){var
nodes=JX.$H(r.tasks).getFragment().firstChild;var
new_task=JX.DOM.find(nodes,'li','maniphest-task');JX.DOM.replace(task,new_task);new
JX.FX(new_task).setDuration(500).start({opacity:[0,1]});};JX.Stratcom.listen('click',['maniphest-edit-task','tag:a'],function(e){e.kill();var
task=e.getNode('maniphest-task');JX.Workflow.newFromLink(e.getNode('tag:a')).setHandler(JX.bind(null,onedit,task)).start();});});