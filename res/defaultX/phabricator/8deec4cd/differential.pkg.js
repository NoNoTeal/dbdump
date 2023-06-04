JX.install('PhabricatorDragAndDropFileUpload',{construct:function(target){if(JX.DOM.isNode(target)){this._node=target;}else{this._sigil=target;}},events:['didBeginDrag','didEndDrag','willUpload','progress','didUpload','didError'],statics:{isSupported:function(){return!!window.FileList;},isPasteSupported:function(){return!!window.FileList;}},members:{_node:null,_sigil:null,_depth:0,_isEnabled:false,setIsEnabled:function(bool){this._isEnabled=bool;return this;},getIsEnabled:function(){return this._isEnabled;},_updateDepth:function(delta){if(this._depth===0&&delta>0){this.invoke('didBeginDrag',this._getTarget());}this._depth+=delta;if(this._depth===0&&delta<0){this.invoke('didEndDrag',this._getTarget());}},_getTarget:function(){return this._target||this._node;},start:function(){function
contains(container,child){do{if(child===container){return true;}child=child.parentNode;}while(child);return false;}var
on_click=JX.bind(this,function(e){if(!this.getIsEnabled()){return;}if(this._depth){e.kill();this._updateDepth(-this._depth);}});var
on_dragenter=JX.bind(this,function(e){if(!this.getIsEnabled()){return;}if(!this._node){var
target=e.getNode(this._sigil);if(target!==this._target){this._updateDepth(-this._depth);this._target=target;}}if(contains(this._getTarget(),e.getTarget())){this._updateDepth(1);}});var
on_dragleave=JX.bind(this,function(e){if(!this.getIsEnabled()){return;}if(!this._getTarget()){return;}if(contains(this._getTarget(),e.getTarget())){this._updateDepth(-1);}});var
on_dragover=JX.bind(this,function(e){if(!this.getIsEnabled()){return;}e.getRawEvent().dataTransfer.dropEffect='copy';e.kill();});var
on_drop=JX.bind(this,function(e){if(!this.getIsEnabled()){return;}e.kill();var
files=e.getRawEvent().dataTransfer.files;for(var
ii=0;ii<files.length;ii++){this.sendRequest(files[ii]);}this._updateDepth(-this._depth);});if(this._node){JX.DOM.listen(this._node,'click',null,on_click);JX.DOM.listen(this._node,'dragenter',null,on_dragenter);JX.DOM.listen(this._node,'dragleave',null,on_dragleave);JX.DOM.listen(this._node,'dragover',null,on_dragover);JX.DOM.listen(this._node,'drop',null,on_drop);}else{JX.Stratcom.listen('click',this._sigil,on_click);JX.Stratcom.listen('dragenter',this._sigil,on_dragenter);JX.Stratcom.listen('dragleave',this._sigil,on_dragleave);JX.Stratcom.listen('dragover',this._sigil,on_dragover);JX.Stratcom.listen('drop',this._sigil,on_drop);}if(JX.PhabricatorDragAndDropFileUpload.isPasteSupported()&&this._node){JX.DOM.listen(this._node,'paste',null,JX.bind(this,function(e){if(!this.getIsEnabled()){return;}var
clipboard=e.getRawEvent().clipboardData;if(!clipboard){return;}var
text=clipboard.getData('text/plain').toString();if(text.length){return;}if(!clipboard.items){return;}for(var
ii=0;ii<clipboard.items.length;ii++){var
item=clipboard.items[ii];if(!/^image\//.test(item.type)){continue;}var
spec=item.getAsFile();if(!spec.name){spec.name='pasted_file';}this.sendRequest(spec);}}));}this.setIsEnabled(true);},sendRequest:function(spec){var
file=new
JX.PhabricatorFileUpload().setRawFileObject(spec).setName(spec.name).setTotalBytes(spec.size);var
threshold=this.getChunkThreshold();if(threshold&&(file.getTotalBytes()>threshold)){this._allocateFile(file);}else{this._sendDataRequest(file);}},_allocateFile:function(file){file.setStatus('allocate').update();this.invoke('willUpload',file);var
alloc_uri=this._getUploadURI(file).setQueryParam('allocate',1);new
JX.Workflow(alloc_uri).setHandler(JX.bind(this,this._didAllocateFile,file)).start();},_getUploadURI:function(file){var
uri=JX.$U(this.getURI()).setQueryParam('name',file.getName()).setQueryParam('length',file.getTotalBytes());if(this.getViewPolicy()){uri.setQueryParam('viewPolicy',this.getViewPolicy());}if(file.getAllocatedPHID()){uri.setQueryParam('phid',file.getAllocatedPHID());}return uri;},_didAllocateFile:function(file,r){var
phid=r.phid;var
upload=r.upload;if(!upload){if(phid){this._completeUpload(file,r);}else{this._failUpload(file,r);}return;}else{if(phid){file.setAllocatedPHID(phid);this._loadChunks(file);}else{this._sendDataRequest(file);}}},_loadChunks:function(file){file.setStatus('chunks').update();var
chunks_uri=this._getUploadURI(file).setQueryParam('querychunks',1);new
JX.Workflow(chunks_uri).setHandler(JX.bind(this,this._didLoadChunks,file)).start();},_didLoadChunks:function(file,r){file.setChunks(r);this._uploadNextChunk(file);},_uploadNextChunk:function(file){var
chunks=file.getChunks();var
chunk;for(var
ii=0;ii<chunks.length;ii++){chunk=chunks[ii];if(!chunk.complete){this._uploadChunk(file,chunk);break;}}},_uploadChunk:function(file,chunk,callback){file.setStatus('upload').update();var
chunkup_uri=this._getUploadURI(file).setQueryParam('uploadchunk',1).setQueryParam('__upload__',1).setQueryParam('byteStart',chunk.byteStart).toString();var
callback=JX.bind(this,this._didUploadChunk,file,chunk);var
req=new
JX.Request(chunkup_uri,callback);var
seen_bytes=0;var
onprogress=JX.bind(this,function(progress){file.addUploadedBytes(progress.loaded-seen_bytes).update();seen_bytes=progress.loaded;this.invoke('progress',file);});req.listen('error',JX.bind(this,this._onUploadError,req,file));req.listen('uploadprogress',onprogress);var
blob=file.getRawFileObject().slice(chunk.byteStart,chunk.byteEnd);req.setRawData(blob).send();},_didUploadChunk:function(file,chunk,r){file.didCompleteChunk(chunk);if(r.complete){this._completeUpload(file,r);}else{this._uploadNextChunk(file);}},_sendDataRequest:function(file){file.setStatus('uploading').update();this.invoke('willUpload',file);var
up_uri=this._getUploadURI(file).setQueryParam('__upload__',1).toString();var
onupload=JX.bind(this,function(r){if(r.error){this._failUpload(file,r);}else{this._completeUpload(file,r);}});var
req=new
JX.Request(up_uri,onupload);var
onprogress=JX.bind(this,function(progress){file.setTotalBytes(progress.total).setUploadedBytes(progress.loaded).update();this.invoke('progress',file);});req.listen('error',JX.bind(this,this._onUploadError,req,file));req.listen('uploadprogress',onprogress);req.setRawData(file.getRawFileObject()).send();},_completeUpload:function(file,r){file.setID(r.id).setPHID(r.phid).setURI(r.uri).setMarkup(r.html).setStatus('done').setTargetNode(this._getTarget()).update();this.invoke('didUpload',file);},_failUpload:function(file,r){file.setStatus('error').setError(r.error).update();this.invoke('didError',file);},_onUploadError:function(req,file,error){file.setStatus('error');if(error){file.setError(error.code+': '+error.info);}else{var
xhr=req.getTransport();if(xhr.responseText){file.setError('Server responded: '+xhr.responseText);}}file.update();this.invoke('didError',file);}},properties:{URI:null,activatedClass:null,viewPolicy:null,chunkThreshold:null}});JX.install('PhabricatorShapedRequest',{construct:function(uri,callback,data_callback){this._uri=uri;this._callback=callback;this._dataCallback=data_callback;},events:['error'],members:{_callback:null,_dataCallback:null,_request:null,_min:null,_defer:null,_last:null,start:function(){this.trigger();},trigger:function(){clearTimeout(this._defer);var
data=this._dataCallback();var
waiting=(this._request);var
recent=(this._min&&(new
Date().getTime()<this._min));if(!waiting&&!recent&&this.shouldSendRequest(this._last,data)){this._last=data;this._request=new
JX.Request(this._uri,JX.bind(this,function(r){this._callback(r);this._min=new
Date().getTime()+this.getRateLimit();clearTimeout(this._defer);this._defer=setTimeout(JX.bind(this,this.trigger),this.getRateLimit());}));this._request.listen('error',JX.bind(this,function(error){this.invoke('error',error,this);}));this._request.listen('finally',JX.bind(this,function(){this._request=null;}));this._request.setData(data);this._request.setTimeout(this.getRequestTimeout());var
routable=this._request.getRoutable();routable.setType('draft').setPriority(750);JX.Router.getInstance().queue(routable);}else{this._defer=setTimeout(JX.bind(this,this.trigger),this.getFrequency());}},shouldSendRequest:function(last,data){if(data===null){return false;}if(last===null){return true;}for(var
k
in
last){if(data[k]!==last[k]){return true;}}return false;}},properties:{rateLimit:500,frequency:1000,requestTimeout:20000}});JX.behavior('differential-populate',function(config,statics){var
onredraw=function(page_id){if(statics.pageID===page_id){return;}var
ii;var
old_lists=get_lists(statics.pageID);for(ii=0;ii<old_lists.length;ii++){old_lists[ii].sleep();}statics.pageID=null;if(statics.pages.hasOwnProperty(page_id)){var
new_lists=get_lists(page_id);for(ii=0;ii<new_lists.length;ii++){new_lists[ii].wake();}statics.pageID=page_id;}};var
get_lists=function(page_id){if(page_id===null){return[];}return statics.pages[page_id]||[];};if(!statics.installed){statics.installed=true;statics.pages={};statics.pageID=null;JX.Stratcom.listen('quicksand-redraw',null,function(e){onredraw(e.getData().newResponseID);});}var
changeset_list=new
JX.DiffChangesetList().setTranslations(JX.phtize(config.pht)).setInlineURI(config.inlineURI).setInlineListURI(config.inlineListURI).setIsStandalone(config.isStandalone);if(config.formationViewID){var
formation_node=JX.$(config.formationViewID);var
formation_view=new
JX.PHUIXFormationView(formation_node);changeset_list.setFormationView(formation_view);formation_view.start();}for(var
ii=0;ii<config.changesetViewIDs.length;ii++){var
id=config.changesetViewIDs[ii];var
node=JX.$(id);var
changeset=changeset_list.newChangesetForNode(node);if(changeset.shouldAutoload()){changeset.setStabilize(true).load();}}var
page_id=JX.Quicksand.getCurrentPageID();statics.pages[page_id]=[changeset_list];onredraw(page_id);var
highlighted=null;var
highlight_class=null;JX.Stratcom.listen(['mouseover','mouseout'],['differential-changeset','tag:td'],function(e){var
t=e.getTarget();if(!t.className.match(/cov|copy/)){return;}if(e.getType()=='mouseout'){JX.Tooltip.hide();if(highlighted){JX.DOM.alterClass(highlighted,highlight_class,false);highlighted=null;}}else{highlight_class=null;var
msg;var
align='W';var
sibling='previousSibling';var
width=120;if(t.className.match(/cov-C/)){msg='Covered';highlight_class='source-cov-C';}else
if(t.className.match(/cov-U/)){msg='Not Covered';highlight_class='source-cov-U';}else
if(t.className.match(/cov-N/)){msg='Not Executable';highlight_class='source-cov-N';}else{var
match=/new-copy|new-move/.exec(t.className);if(match){sibling='nextSibling';width=500;msg=JX.Stratcom.getData(t).msg;highlight_class=match[0];}}if(msg){JX.Tooltip.show(t,width,align,msg);}if(highlight_class){highlighted=t[sibling];JX.DOM.alterClass(highlighted,highlight_class,true);}}});});JX.behavior('differential-diff-radios',function(config){JX.Stratcom.listen('click','differential-new-radio',function(e){var
target=e.getTarget();var
adjust;var
node;var
reset=false;for(var
ii=0;ii<config.radios.length;ii++){node=JX.$(config.radios[ii]);if(parseInt(node.value,10)>=parseInt(target.value,10)){if(node.checked){node.checked=false;reset=true;}node.disabled='disabled';}else{node.disabled='';if(!adjust||adjust.value<node.value){adjust=node;}}}if(reset&&adjust){adjust.checked='checked';}});});JX.behavior('aphront-drag-and-drop-textarea',function(config){var
target=JX.$(config.target);if(JX.PhabricatorDragAndDropFileUpload.isSupported()){var
drop=new
JX.PhabricatorDragAndDropFileUpload(target).setURI(config.uri).setChunkThreshold(config.chunkThreshold);drop.listen('didBeginDrag',function(){JX.DOM.alterClass(target,config.activatedClass,true);});drop.listen('didEndDrag',function(){JX.DOM.alterClass(target,config.activatedClass,false);});drop.listen('didUpload',function(file){JX.TextAreaUtils.insertFileReference(target,file);});drop.start();}});JX.behavior('phabricator-object-selector',function(config){var
n=0;var
phids={};var
display=[];var
handles=config.handles;for(var
k
in
handles){phids[k]=true;}var
query_timer=null;var
query_delay=50;var
inputs=JX.DOM.scry(JX.$(config.form),'input','aphront-dialog-application-input');var
phid_input;for(var
ii=0;ii<inputs.length;ii++){if(inputs[ii].name=='phids'){phid_input=inputs[ii];break;}}var
last_value=JX.$(config.query).value;function
onreceive(seq,r){if(seq!=n){return;}display=[];for(var
k
in
r){handles[r[k].phid]=r[k];display.push({phid:r[k].phid});}redrawList(true);}function
redrawAttached(){var
attached=[];for(var
k
in
phids){attached.push(renderHandle(handles[k],false).item);}if(!attached.length){attached=renderNote('Nothing attached.');}JX.DOM.setContent(JX.$(config.current),attached);phid_input.value=JX.keys(phids).join(';');}function
redrawList(rebuild){var
ii;var
content;if(rebuild){if(display.length){var
handle;content=[];for(ii=0;ii<display.length;ii++){handle=handles[display[ii].phid];display[ii].node=renderHandle(handle,true);content.push(display[ii].node.item);}}else{content=renderNote('No results.');}JX.DOM.setContent(JX.$(config.results),content);}var
phid;var
is_disabled;var
button;var
at_maximum=!canSelectMore();for(ii=0;ii<display.length;ii++){phid=display[ii].phid;is_disabled=false;if(phids.hasOwnProperty(phid)){is_disabled=true;}if(at_maximum){is_disabled=true;}button=display[ii].node.button;JX.DOM.alterClass(button,'disabled',is_disabled);button.disabled=is_disabled;}}function
renderHandle(h,attach){var
some_icon=JX.$N('span',{className:'phui-icon-view phui-font-fa '+'fa-external-link phabricator-object-selector-popicon'},'');var
view_object_link=JX.$N('a',{href:h.uri,target:'_blank'},some_icon);var
select_object_link=JX.$N('a',{href:'#',sigil:'object-attacher'},h.name);var
select_object_button=JX.$N('a',{href:'#',sigil:'object-attacher',className:'button small button-grey'},attach?'Select':'Remove');var
cells=[JX.$N('td',{},view_object_link),JX.$N('th',{},select_object_link),JX.$N('td',{},select_object_button)];var
table=JX.$N('table',{className:'phabricator-object-selector-handle'});table.appendChild(JX.$N('tr',{sigil:'object-attach-row',className:'phabricator-object-selector-row',meta:{handle:h,table:table}},cells));return{item:table,button:select_object_button};}function
renderNote(note){return JX.$N('div',{className:'object-selector-nothing'},note);}function
sendQuery(){query_timer=null;JX.DOM.setContent(JX.$(config.results),renderNote('Loading...'));new
JX.Request(config.uri,JX.bind(null,onreceive,++n)).setData({filter:JX.$(config.filter).value,exclude:config.exclude,query:JX.$(config.query).value}).send();}function
canSelectMore(){if(!config.maximum){return true;}if(JX.keys(phids).length<config.maximum){return true;}return false;}JX.DOM.listen(JX.$(config.results),'click','object-attacher',function(e){e.kill();var
data=e.getNodeData('object-attach-row');var
phid=data.handle.phid;if(phids[phid]){return;}if(!canSelectMore()){return;}phids[phid]=true;redrawList(false);redrawAttached();});JX.DOM.listen(JX.$(config.current),'click','object-attacher',function(e){e.kill();var
data=e.getNodeData('object-attach-row');var
phid=data.handle.phid;delete
phids[phid];redrawList(false);redrawAttached();});JX.DOM.listen(JX.$(config.filter),'change',null,function(e){e.kill();sendQuery();});JX.DOM.listen(JX.$(config.query),['change','keydown','keyup','keypress'],null,function(){var
cur_value=JX.$(config.query).value;if(last_value==cur_value){return;}last_value=cur_value;clearTimeout(query_timer);query_timer=setTimeout(sendQuery,query_delay);});sendQuery();redrawList(true);redrawAttached();});JX.behavior('repository-crossreference',function(config,statics){var
highlighted;var
linked=[];function
isMacOS(){return(navigator.platform.indexOf('Mac')>-1);}function
isHighlightModifierKey(e){var
signal_key;if(isMacOS()){signal_key=91;}else{signal_key=17;}return(e.getRawEvent().keyCode===signal_key);}function
hasHighlightModifierKey(e){if(isMacOS()){return e.getRawEvent().metaKey;}else{return e.getRawEvent().ctrlKey;}}var
classHighlight='crossreference-item';var
classMouseCursor='crossreference-cursor';var
class_map={nc:'class',nf:'function',na:null,nb:'builtin',n:null};function
link(element,lang){JX.DOM.alterClass(element,'repository-crossreference',true);linked.push(element);JX.DOM.listen(element,['mouseover','mouseout','click'],'tag:span',function(e){if(e.getType()==='mouseout'){unhighlight();return;}if(!hasHighlightModifierKey(e)){return;}var
target=e.getTarget();if(!canLinkNode(target)){return;}if(JX.DOM.isNode(target,'span')&&(target.className==='bright')){target=target.parentNode;}if(e.getType()==='mouseover'){while(target&&target!==document.body){if(JX.DOM.isNode(target,'span')&&(target.className
in
class_map)){highlighted=target;JX.DOM.alterClass(highlighted,classHighlight,true);break;}target=target.parentNode;}}else
if(e.getType()==='click'){openSearch(target,{lang:lang});}});}function
canLinkNode(node){try{if(JX.DOM.findAbove(node,'div','differential-inline-comment')){return false;}}catch(ex){}try{if(JX.DOM.findAbove(node,'h1')){return false;}}catch(ex){}return true;}function
unhighlight(){highlighted&&JX.DOM.alterClass(highlighted,classHighlight,false);highlighted=null;}function
openSearch(target,context){var
symbol=target.textContent||target.innerText;context=context||{};context.lang=context.lang||null;context.repositories=context.repositories||(config&&config.repositories)||[];var
query=JX.copy({},context);if(query.repositories.length){query.repositories=query.repositories.join(',');}else{delete
query.repositories;}query.jump=true;var
c=target.className;c=c.replace(classHighlight,'').trim();if(class_map[c]){query.type=class_map[c];}if(target.hasAttribute('data-symbol-context')){query.context=target.getAttribute('data-symbol-context');}if(target.hasAttribute('data-symbol-name')){symbol=target.getAttribute('data-symbol-name');}var
line=getLineNumber(target);if(line!==null){query.line=line;}if(!query.hasOwnProperty('path')){var
path=getPath(target);if(path!==null){query.path=path;}}var
char=getChar(target);if(char!==null){query.char=char;}var
uri_symbol=symbol;uri_symbol=uri_symbol.trim();uri_symbol=encodeURIComponent(uri_symbol);uri_symbol=encodeURIComponent(uri_symbol);var
uri=JX.$U('/diffusion/symbol/'+uri_symbol+'/');uri.addQueryParams(query);window.open(uri.toString());}function
linkAll(){var
blocks=JX.DOM.scry(document.body,'div','remarkup-code-block');for(var
i=0;i<blocks.length;++i){if(blocks[i].hasAttribute('data-code-lang')){var
lang=blocks[i].getAttribute('data-code-lang');link(blocks[i],lang);}}}function
getLineNumber(target){var
cell=JX.DOM.findAbove(target,'td');if(!cell){return null;}var
row=JX.DOM.findAbove(target,'tr');if(!row){return null;}var
ii;var
cell_list=[];for(ii=0;ii<row.childNodes.length;ii++){cell_list.push(row.childNodes[ii]);}cell_list.reverse();var
found=false;for(ii=0;ii<cell_list.length;ii++){if(cell_list[ii]===cell){found=true;}if(found&&JX.DOM.isType(cell_list[ii],'th')){var
int_value=parseInt(cell_list[ii].textContent,10);if(int_value){return int_value;}}}return null;}function
getPath(target){var
changeset;try{changeset=JX.DOM.findAbove(target,'div','differential-changeset');return JX.Stratcom.getData(changeset).symbolPath||null;}catch(ex){}return null;}function
getChar(target){var
cell=JX.DOM.findAbove(target,'td');if(!cell){return null;}var
char=1;for(var
ii=0;ii<cell.childNodes.length;ii++){var
node=cell.childNodes[ii];if(node===target){return char;}var
content=''+node.textContent;char+=content.length;}return null;}JX.Stratcom.listen('differential-preview-update',null,function(e){linkAll(e.getData().container);});JX.Stratcom.listen(['keydown','keyup'],null,function(e){if(!isHighlightModifierKey(e)){return;}setCursorMode(e.getType()==='keydown');if(!statics.active){unhighlight();}});JX.Stratcom.listen('blur',null,function(e){if(e.getTarget()){return;}unhighlight();setCursorMode(false);});function
setCursorMode(active){statics.active=active;linked.forEach(function(element){JX.DOM.alterClass(element,classMouseCursor,statics.active);});}if(config&&config.container){link(JX.$(config.container),config.lang);}JX.Stratcom.listen(['mouseover','mouseout','click'],['has-symbols','tag:span'],function(e){var
type=e.getType();if(type==='mouseout'){unhighlight();return;}if(!hasHighlightModifierKey(e)){return;}var
target=e.getTarget();if(!canLinkNode(target)){return;}if(JX.DOM.isNode(target,'span')&&(target.className==='bright')){target=target.parentNode;}if(type==='click'){openSearch(target,e.getNodeData('has-symbols').symbols);e.kill();return;}if(e.getType()==='mouseover'){while(target&&target!==document.body){if(!JX.DOM.isNode(target,'span')){target=target.parentNode;continue;}if(!class_map.hasOwnProperty(target.className)){target=target.parentNode;continue;}highlighted=target;JX.DOM.alterClass(highlighted,classHighlight,true);break;}}});});JX.behavior('aphront-more',function(){JX.Stratcom.listen('click','aphront-more-view-show-more',function(e){e.kill();var
node=e.getNode('aphront-more-view');var
more=JX.$H(e.getNodeData('aphront-more-view-show-more').more);JX.DOM.setContent(node,more);});});JX.install('DiffInlineContentState',{construct:function(){},properties:{text:null,suggestionText:null,hasSuggestion:false},members:{readForm:function(row){var
node;try{node=JX.DOM.find(row,'textarea','inline-content-text');this.setText(node.value);}catch(ex){this.setText(null);}node=this._getSuggestionNode(row);if(node){this.setSuggestionText(node.value);}else{this.setSuggestionText(null);}return this;},getWireFormat:function(){return{text:this.getText(),suggestionText:this.getSuggestionText(),hasSuggestion:this.getHasSuggestion()};},readWireFormat:function(map){this.setText(map.text||null);this.setSuggestionText(map.suggestionText||null);this.setHasSuggestion(!!map.hasSuggestion);return this;},getTextForQuote:function(){var
text=this.getText();text='> '+text.replace(/\n/g,'\n> ')+'\n\n';return text;},isStateEmpty:function(){return(this.isTextEmpty()&&this.isSuggestionEmpty());},isTextEmpty:function(){var
text=this.getText();if(text===null){return true;}if(this._isStringSimilar(text,'')){return true;}return false;},isSuggestionEmpty:function(){if(!this.getHasSuggestion()){return true;}var
suggestion=this.getSuggestionText();if(suggestion===null){return true;}if(this._isStringSimilar(suggestion,'')){return true;}return false;},isTextSimilar:function(v){if(!v){return false;}var
us=this.getText();var
vs=v.getText();return this._isStringSimilar(us,vs);},isSuggestionSimilar:function(v){if(!v){return false;}var
us=this.getSuggestionText();var
vs=v.getSuggestionText();return this._isStringSimilar(us,vs);},_isStringSimilar:function(u,v){u=u||'';v=v||'';return(u===v);},_getSuggestionNode:function(row){try{return JX.DOM.find(row,'textarea','inline-content-suggestion');}catch(ex){return null;}}}});JX.install('DiffInline',{construct:function(){this._state={};},members:{_id:null,_phid:null,_changesetID:null,_row:null,_number:null,_length:null,_displaySide:null,_isNewFile:null,_replyToCommentPHID:null,_snippet:null,_menuItems:null,_documentEngineKey:null,_isDeleted:false,_isInvisible:false,_isLoading:false,_changeset:null,_isCollapsed:false,_isDraft:null,_isDraftDone:null,_isFixed:null,_isEditing:false,_isNew:false,_isSynthetic:false,_isHidden:false,_editRow:null,_undoRow:null,_undoType:null,_undoState:null,_draftRequest:null,_skipFocus:false,_menu:null,_startOffset:null,_endOffset:null,_isSelected:false,_canSuggestEdit:false,_state:null,bindToRow:function(row){this._row=row;var
row_data=JX.Stratcom.getData(row);row_data.inline=this;this._isCollapsed=row_data.hidden||false;var
comment=JX.DOM.find(row,'div','differential-inline-comment');var
data=JX.Stratcom.getData(comment);this._readInlineState(data);this._phid=data.phid;if(data.on_right){this._displaySide='right';}else{this._displaySide='left';}this._number=parseInt(data.number,10);this._length=parseInt(data.length,10);this._isNewFile=data.isNewFile;this._replyToCommentPHID=data.replyToCommentPHID;this._isDraft=data.isDraft;this._isFixed=data.isFixed;this._isGhost=data.isGhost;this._isSynthetic=data.isSynthetic;this._isDraftDone=data.isDraftDone;this._changesetID=data.changesetID;this._isNew=false;this._snippet=data.snippet;this._menuItems=data.menuItems;this._documentEngineKey=data.documentEngineKey;this._startOffset=data.startOffset;this._endOffset=data.endOffset;this._isEditing=data.isEditing;if(this._isEditing){this.edit(null,true);}else{this.setInvisible(false);}this._startDrafts();return this;},isDraft:function(){return this._isDraft;},isDone:function(){return this._isFixed;},isEditing:function(){return this._isEditing;},isUndo:function(){return!!this._undoRow;},isDeleted:function(){return this._isDeleted;},isSynthetic:function(){return this._isSynthetic;},isDraftDone:function(){return this._isDraftDone;},isHidden:function(){return this._isHidden;},isGhost:function(){return this._isGhost;},getStartOffset:function(){return this._startOffset;},getEndOffset:function(){return this._endOffset;},setIsSelected:function(is_selected){this._isSelected=is_selected;if(this._row){JX.DOM.alterClass(this._row,'inline-comment-selected',this._isSelected);}return this;},bindToRange:function(data){this._displaySide=data.displaySide;this._number=parseInt(data.number,10);this._length=parseInt(data.length,10);this._isNewFile=data.isNewFile;this._changesetID=data.changesetID;this._isNew=true;if(data.hasOwnProperty('startOffset')){this._startOffset=data.startOffset;}else{this._startOffset=null;}if(data.hasOwnProperty('endOffset')){this._endOffset=data.endOffset;}else{this._endOffset=null;}var
parent_row=JX.DOM.findAbove(data.target,'tr');var
target_row=parent_row.nextSibling;while(target_row&&JX.Stratcom.hasSigil(target_row,'inline-row')){target_row=target_row.nextSibling;}var
row=this._newRow();parent_row.parentNode.insertBefore(row,target_row);this.setInvisible(true);this._startDrafts();return this;},bindToReply:function(inline){this._displaySide=inline._displaySide;this._number=inline._number;this._length=inline._length;this._isNewFile=inline._isNewFile;this._changesetID=inline._changesetID;this._isNew=true;this._documentEngineKey=inline._documentEngineKey;this._replyToCommentPHID=inline._phid;var
changeset=this.getChangeset();var
ancestor_map={};var
ancestor=inline;var
reply_phid;while(ancestor){reply_phid=ancestor.getReplyToCommentPHID();if(!reply_phid){break;}ancestor_map[reply_phid]=true;ancestor=changeset.getInlineByPHID(reply_phid);}var
parent_row=inline._row;var
target_row=parent_row.nextSibling;while(target_row&&JX.Stratcom.hasSigil(target_row,'inline-row')){var
target=changeset.getInlineForRow(target_row);reply_phid=target.getReplyToCommentPHID();if(ancestor_map.hasOwnProperty(reply_phid)){break;}target_row=target_row.nextSibling;}var
row=this._newRow();parent_row.parentNode.insertBefore(row,target_row);this.setInvisible(true);this._startDrafts();return this;},setChangeset:function(changeset){this._changeset=changeset;return this;},getChangeset:function(){return this._changeset;},setEditing:function(editing){this._isEditing=editing;return this;},setHidden:function(hidden){this._isHidden=hidden;this._redraw();return this;},canReply:function(){return this._hasMenuAction('reply');},canEdit:function(){return this._hasMenuAction('edit');},canDone:function(){if(!JX.DOM.scry(this._row,'input','differential-inline-done').length){return false;}return true;},canCollapse:function(){return this._hasMenuAction('collapse');},_newRow:function(){var
attributes={sigil:'inline-row'};var
row=JX.$N('tr',attributes);JX.Stratcom.getData(row).inline=this;this._row=row;this._id=null;this._phid=null;this._isCollapsed=false;return row;},setCollapsed:function(collapsed){this._closeMenu();this._isCollapsed=collapsed;var
op;if(collapsed){op='hide';}else{op='show';}var
inline_uri=this._getInlineURI();var
comment_id=this._id;new
JX.Workflow(inline_uri,{op:op,ids:comment_id}).setHandler(JX.bag).start();this._redraw();this._didUpdate(true);},isCollapsed:function(){return this._isCollapsed;},toggleDone:function(){var
uri=this._getInlineURI();var
data={op:'done',id:this._id};var
ondone=JX.bind(this,this._ondone);new
JX.Workflow(uri,data).setHandler(ondone).start();},_ondone:function(response){var
checkbox=JX.DOM.find(this._row,'input','differential-inline-done');checkbox.checked=(response.isChecked?'checked':null);var
comment=JX.DOM.findAbove(checkbox,'div','differential-inline-comment');JX.DOM.alterClass(comment,'inline-is-done',response.isChecked);JX.DOM.alterClass(comment,'inline-state-is-draft',response.draftState);this._isFixed=response.isChecked;this._isDraftDone=!!response.draftState;this._didUpdate();},create:function(content_state){var
changeset=this.getChangeset();if(!this._documentEngineKey){this._documentEngineKey=changeset.getResponseDocumentEngineKey();}var
uri=this._getInlineURI();var
handler=JX.bind(this,this._oncreateresponse);var
data=this._newRequestData('new',content_state);this.setLoading(true);new
JX.Request(uri,handler).setData(data).send();},reply:function(with_quote){this._closeMenu();var
content_state=this._newContentState();if(with_quote){var
text=this._getActiveContentState().getTextForQuote();content_state.text=text;}var
changeset=this.getChangeset();return changeset.newInlineReply(this,content_state);},edit:function(content_state,skip_focus){this._closeMenu();this._skipFocus=!!skip_focus;if(this._undoRow){JX.DOM.remove(this._undoRow);this._undoRow=null;this._undoType=null;this._undoText=null;}this._applyEdit(content_state);},delete:function(is_ref){var
uri=this._getInlineURI();var
handler=JX.bind(this,this._ondeleteresponse,false);var
op;if(is_ref){op='refdelete';}else{op='delete';}var
data=this._newRequestData(op);this.setLoading(true);new
JX.Workflow(uri,data).setHandler(handler).start();},getDisplaySide:function(){return this._displaySide;},getLineNumber:function(){return this._number;},getLineLength:function(){return this._length;},isNewFile:function(){return this._isNewFile;},getID:function(){return this._id;},getPHID:function(){return this._phid;},getChangesetID:function(){return this._changesetID;},getReplyToCommentPHID:function(){return this._replyToCommentPHID;},setDeleted:function(deleted){this._isDeleted=deleted;this._redraw();return this;},setInvisible:function(invisible){this._isInvisible=invisible;this._redraw();return this;},setLoading:function(loading){this._isLoading=loading;this._redraw();return this;},_newRequestData:function(operation,content_state){var
data={op:operation,is_new:this.isNewFile(),on_right:((this.getDisplaySide()=='right')?1:0),renderer:this.getChangeset().getRendererKey()};if(operation==='new'){var
create_data={changesetID:this.getChangesetID(),documentEngineKey:this._documentEngineKey,replyToCommentPHID:this.getReplyToCommentPHID(),startOffset:this._startOffset,endOffset:this._endOffset,number:this.getLineNumber(),length:this.getLineLength()};JX.copy(data,create_data);}else{var
edit_data={id:this._id};JX.copy(data,edit_data);}if(content_state){data.hasContentState=1;JX.copy(data,content_state);}return data;},_oneditresponse:function(response){var
rows=JX.$H(response.view).getNode();this._readInlineState(response.inline);this._drawEditRows(rows);this.setInvisible(true);},_oncreateresponse:function(response){var
rows=JX.$H(response.view).getNode();this._readInlineState(response.inline);this._drawEditRows(rows);},_readInlineState:function(state){this._id=state.id;this._state={initial:this._newContentStateFromWireFormat(state.state.initial),committed:this._newContentStateFromWireFormat(state.state.committed),active:this._newContentStateFromWireFormat(state.state.active)};this._canSuggestEdit=state.canSuggestEdit;},_newContentStateFromWireFormat:function(map){if(map===null){return null;}return new
JX.DiffInlineContentState().readWireFormat(map);},_ondeleteresponse:function(prevent_undo){if(!prevent_undo){if(this._undoRow){JX.DOM.remove(this._undoRow);this._undoRow=null;}var
state=null;if(this._editRow){state=this._getActiveContentState().getWireFormat();JX.DOM.remove(this._editRow);this._editRow=null;}this._drawUndeleteRows(state);}this.setLoading(false);this.setDeleted(true);this._didUpdate();},_drawUndeleteRows:function(content_state){this._undoType='undelete';this._undoState=content_state||null;return this._drawUndoRows('undelete',this._row);},_drawUneditRows:function(content_state){this._undoType='unedit';this._undoState=content_state;return this._drawUndoRows('unedit',null);},_drawUndoRows:function(mode,cursor){var
templates=this.getChangeset().getUndoTemplates();var
template;if(this.getDisplaySide()=='right'){template=templates.r;}else{template=templates.l;}template=JX.$H(template).getNode();this._undoRow=this._drawRows(template,cursor,mode);},_drawContentRows:function(rows){return this._drawRows(rows,null,'content');},_drawEditRows:function(rows){this.setEditing(true);this._editRow=this._drawRows(rows,null,'edit');this._drawSuggestionState(this._editRow);this.setHasSuggestion(this.getHasSuggestion());},_drawRows:function(rows,cursor,type){var
first_row=JX.DOM.scry(rows,'tr')[0];var
row=first_row;var
anchor=cursor||this._row;cursor=cursor||this._row.nextSibling;var
result_row;var
next_row;while(row){next_row=row.nextSibling;JX.Stratcom.getData(row).inline=this;anchor.parentNode.insertBefore(row,cursor);cursor=row;if(!result_row){result_row=row;}if(!this._skipFocus){var
textareas=JX.DOM.scry(row,'textarea','inline-content-text');if(textareas.length){var
area=textareas[0];area.focus();var
length=area.value.length;JX.TextAreaUtils.setSelectionRange(area,length,length);}}row=next_row;}JX.Stratcom.invoke('resize');return result_row;},_drawSuggestionState:function(row){if(this._canSuggestEdit){var
button=this._getSuggestionButton();var
node=button.getNode();JX.DOM.alterClass(node,'disabled',false);node.disabled=false;var
container=JX.DOM.find(row,'div','inline-edit-buttons');container.appendChild(node);}},_getSuggestionButton:function(){if(!this._suggestionButton){var
button=new
JX.PHUIXButtonView().setIcon('fa-pencil-square-o').setColor('grey');var
node=button.getNode();JX.DOM.alterClass(node,'inline-button-left',true);var
onclick=JX.bind(this,this._onSuggestEdit);JX.DOM.listen(node,'click',null,onclick);this._suggestionButton=button;}return this._suggestionButton;},_onSuggestEdit:function(e){e.kill();this.setHasSuggestion(!this.getHasSuggestion());if(this.getHasSuggestion()){if(this._editRow){var
node=this._getSuggestionNode(this._editRow);if(node){node.rows=Math.max(3,node.value.split('\n').length);}}}this.triggerDraft();},_getActiveContentState:function(){var
state=this._state.active;if(this._editRow){state.readForm(this._editRow);}return state;},_getCommittedContentState:function(){return this._state.committed;},_getInitialContentState:function(){return this._state.initial;},setHasSuggestion:function(has_suggestion){var
state=this._getActiveContentState();state.setHasSuggestion(has_suggestion);var
button=this._getSuggestionButton();var
pht=this.getChangeset().getChangesetList().getTranslations();if(has_suggestion){button.setIcon('fa-times').setText(pht('Discard Edit'));}else{button.setIcon('fa-plus').setText(pht('Suggest Edit'));}if(this._editRow){JX.DOM.alterClass(this._editRow,'has-suggestion',has_suggestion);}},getHasSuggestion:function(){return this._getActiveContentState().getHasSuggestion();},save:function(){if(this._shouldDeleteOnSave()){JX.DOM.remove(this._editRow);this._editRow=null;this._applyDelete(true);return;}this._applySave();},_shouldDeleteOnSave:function(){var
active=this._getActiveContentState();var
initial=this._getInitialContentState();if(!active.isTextEmpty()){return false;}if(active.getHasSuggestion()){if(!active.isSuggestionSimilar(initial)){return false;}}return true;},_shouldUndoOnCancel:function(){var
committed=this._getCommittedContentState();var
active=this._getActiveContentState();var
initial=this._getInitialContentState();var
versus=committed||initial;if(!active.isTextEmpty()&&!active.isTextSimilar(versus)){return true;}if(active.getHasSuggestion()){if(!active.isSuggestionSimilar(versus)){return true;}}return false;},_applySave:function(){var
handler=JX.bind(this,this._onsaveresponse);var
state=this._getActiveContentState();var
data=this._newRequestData('save',state.getWireFormat());this._applyCall(handler,data);},_applyDelete:function(prevent_undo){var
handler=JX.bind(this,this._ondeleteresponse,prevent_undo);var
data=this._newRequestData('delete');this._applyCall(handler,data);},_applyCancel:function(state){var
handler=JX.bind(this,this._onCancelResponse);var
data=this._newRequestData('cancel',state);this._applyCall(handler,data);},_applyEdit:function(state){var
handler=JX.bind(this,this._oneditresponse);var
data=this._newRequestData('edit',state);this._applyCall(handler,data);},_applyCall:function(handler,data){var
uri=this._getInlineURI();var
callback=JX.bind(this,function(){this.setLoading(false);handler.apply(null,arguments);});this.setLoading(true);new
JX.Workflow(uri,data).setHandler(callback).start();},undo:function(){JX.DOM.remove(this._undoRow);this._undoRow=null;if(this._undoType==='undelete'){var
uri=this._getInlineURI();var
data=this._newRequestData('undelete');var
handler=JX.bind(this,this._onundelete);this.setDeleted(false);this.setLoading(true);new
JX.Request(uri,handler).setData(data).send();}if(this._undoState!==null){this.edit(this._undoState);}},_onundelete:function(){this.setLoading(false);this._didUpdate();},cancel:function(){var
state=this._getActiveContentState().getWireFormat();JX.DOM.remove(this._editRow);this._editRow=null;var
is_delete=(this._getCommittedContentState()===null);var
is_undo=this._shouldUndoOnCancel();if(is_undo){this._drawUneditRows(state);}if(is_delete){this._applyDelete(true);}else{this.setEditing(false);this.setInvisible(false);var
old_state=this._getCommittedContentState();this._applyCancel(old_state.getWireFormat());this._didUpdate(true);}},_onCancelResponse:function(response){},_getSuggestionNode:function(row){try{return JX.DOM.find(row,'textarea','inline-content-suggestion');}catch(ex){return null;}},_onsaveresponse:function(response){if(this._editRow){JX.DOM.remove(this._editRow);this._editRow=null;}this.setEditing(false);this.setInvisible(false);var
new_row=this._drawContentRows(JX.$H(response.view).getNode());JX.DOM.remove(this._row);this.bindToRow(new_row);this._didUpdate();},_didUpdate:function(local_only){if(!local_only){this.getChangeset().getChangesetList().redrawPreview();}this.getChangeset().getChangesetList().redrawCursor();this.getChangeset().getChangesetList().resetHover();JX.Stratcom.invoke('resize');},_redraw:function(){var
is_invisible=(this._isInvisible||this._isDeleted||this._isHidden);var
is_loading=this._isLoading;var
is_collapsed=(this._isCollapsed&&!this._isHidden);var
row=this._row;JX.DOM.alterClass(row,'differential-inline-hidden',is_invisible);JX.DOM.alterClass(row,'differential-inline-loading',is_loading);JX.DOM.alterClass(row,'inline-hidden',is_collapsed);},_getInlineURI:function(){var
changeset=this.getChangeset();var
list=changeset.getChangesetList();return list.getInlineURI();},_startDrafts:function(){if(this._draftRequest){return;}var
onresponse=JX.bind(this,this._onDraftResponse);var
draft=JX.bind(this,this._getDraftState);var
uri=this._getInlineURI();var
request=new
JX.PhabricatorShapedRequest(uri,onresponse,draft);request.setRateLimit(2000);this._draftRequest=request;request.start();},_onDraftResponse:function(){},_getDraftState:function(){if(this.isDeleted()){return null;}if(!this.isEditing()){return null;}var
state=this._getActiveContentState();if(state.isStateEmpty()){return null;}var
draft_data={op:'draft',id:this.getID(),};JX.copy(draft_data,state.getWireFormat());return draft_data;},triggerDraft:function(){if(this._draftRequest){this._draftRequest.trigger();}},activateMenu:function(button,e){var
data=JX.Stratcom.getData(button);if(data.menu){return;}e.prevent();var
menu=new
JX.PHUIXDropdownMenu(button).setWidth(240);var
list=new
JX.PHUIXActionListView();var
items=this._newMenuItems(menu);for(var
ii=0;ii<items.length;ii++){list.addItem(items[ii]);}menu.setContent(list.getNode());data.menu=menu;this._menu=menu;menu.listen('open',JX.bind(this,function(){var
changeset_list=this.getChangeset().getChangesetList();changeset_list.selectInline(this,true);}));menu.open();},_newMenuItems:function(menu){var
items=[];for(var
ii=0;ii<this._menuItems.length;ii++){var
spec=this._menuItems[ii];var
onmenu=JX.bind(this,this._onMenuItem,menu,spec.action,spec);var
item=new
JX.PHUIXActionView().setIcon(spec.icon).setName(spec.label).setHandler(onmenu);if(spec.key){item.setKeyCommand(spec.key);}items.push(item);}return items;},_onMenuItem:function(menu,action,spec,e){e.prevent();menu.close();switch(action){case'reply':this.reply();break;case'quote':this.reply(true);break;case'collapse':this.setCollapsed(true);break;case'delete':this.delete();break;case'edit':this.edit();break;case'raw':new
JX.Workflow(spec.uri).start();break;}},_hasMenuAction:function(action){for(var
ii=0;ii<this._menuItems.length;ii++){var
spec=this._menuItems[ii];if(spec.action===action){return true;}}return false;},_closeMenu:function(){if(this._menu){this._menu.close();}},_newContentState:function(){return{text:'',suggestionText:'',hasSuggestion:false};}}});JX.install('DiffChangeset',{construct:function(node){this._node=node;var
data=this._getNodeData();this._renderURI=data.renderURI;this._ref=data.ref;this._loaded=data.loaded;this._treeNodeID=data.treeNodeID;this._leftID=data.left;this._rightID=data.right;this._displayPath=JX.$H(data.displayPath);this._pathParts=data.pathParts;this._icon=data.icon;this._editorURITemplate=data.editorURITemplate;this._editorConfigureURI=data.editorConfigureURI;this._showPathURI=data.showPathURI;this._showDirectoryURI=data.showDirectoryURI;this._pathIconIcon=data.pathIconIcon;this._pathIconColor=data.pathIconColor;this._isLowImportance=data.isLowImportance;this._isOwned=data.isOwned;this._isLoading=true;this._inlines=null;if(data.changesetState){this._loadChangesetState(data.changesetState);}JX.enableDispatch(window,'selectstart');var
onselect=JX.bind(this,this._onClickHeader);JX.DOM.listen(this._node,['mousedown','selectstart'],'changeset-header',onselect);},members:{_node:null,_loaded:false,_sequence:0,_stabilize:false,_renderURI:null,_ref:null,_rendererKey:null,_highlight:null,_requestDocumentEngineKey:null,_responseDocumentEngineKey:null,_availableDocumentEngineKeys:null,_characterEncoding:null,_undoTemplates:null,_leftID:null,_rightID:null,_inlines:null,_visible:true,_displayPath:null,_changesetList:null,_icon:null,_editorURITemplate:null,_editorConfigureURI:null,_showPathURI:null,_showDirectoryURI:null,_pathView:null,_pathIconIcon:null,_pathIconColor:null,_isLowImportance:null,_isOwned:null,_isHidden:null,_isSelected:false,_viewMenu:null,getEditorURITemplate:function(){return this._editorURITemplate;},getEditorConfigureURI:function(){return this._editorConfigureURI;},getShowPathURI:function(){return this._showPathURI;},getShowDirectoryURI:function(){return this._showDirectoryURI;},getLeftChangesetID:function(){return this._leftID;},getRightChangesetID:function(){return this._rightID;},setChangesetList:function(list){this._changesetList=list;return this;},setViewMenu:function(menu){this._viewMenu=menu;return this;},getIcon:function(){if(!this._visible){return'fa-file-o';}return this._icon;},getColor:function(){if(!this._visible){return'grey';}return'blue';},getChangesetList:function(){return this._changesetList;},isLoaded:function(){return this._loaded;},setStabilize:function(stabilize){this._stabilize=stabilize;return this;},shouldAutoload:function(){return this._getNodeData().autoload;},load:function(){if(this._loaded){return this;}return this.reload();},reload:function(state){this._loaded=true;this._sequence++;var
workflow=this._newReloadWorkflow(state).setHandler(JX.bind(this,this._onresponse,this._sequence));this._startContentWorkflow(workflow);var
pht=this.getChangesetList().getTranslations();JX.DOM.setContent(this._getContentFrame(),JX.$N('div',{className:'differential-loading'},pht('Loading...')));return this;},_newReloadWorkflow:function(state){var
params=this._getViewParameters(state);return new
JX.Workflow(this._renderURI,params);},loadContext:function(range,target,bulk){var
params=this._getViewParameters();params.range=range;var
pht=this.getChangesetList().getTranslations();var
container=JX.DOM.scry(target,'td')[0];JX.DOM.setContent(container,pht('Loading...'));JX.DOM.alterClass(target,'differential-show-more-loading',true);var
workflow=new
JX.Workflow(this._renderURI,params).setHandler(JX.bind(this,this._oncontext,target));if(bulk){this._startContentWorkflow(workflow);}else{workflow.start();}return this;},loadAllContext:function(){var
nodes=JX.DOM.scry(this._node,'tr','context-target');for(var
ii=0;ii<nodes.length;ii++){var
show=JX.DOM.scry(nodes[ii],'a','show-more');for(var
jj=0;jj<show.length;jj++){var
data=JX.Stratcom.getData(show[jj]);if(data.type!='all'){continue;}this.loadContext(data.range,nodes[ii],true);}}},_startContentWorkflow:function(workflow){var
routable=workflow.getRoutable();routable.setPriority(500).setType('content').setKey(this._getRoutableKey());JX.Router.getInstance().queue(routable);},getDisplayPath:function(){return this._displayPath;},_oncontext:function(target,response){var
markup=JX.$H(response.changeset).getFragment();var
len=markup.childNodes.length;var
diff=JX.DOM.findAbove(target,'table','differential-diff');for(var
ii=0;ii<len-1;ii++){diff.parentNode.insertBefore(markup.firstChild,diff);}var
table=markup.firstChild;var
root=target.parentNode;this._moveRows(table,root,target);root.removeChild(target);this._onchangesetresponse(response);},_moveRows:function(src,dst,before){var
rows=JX.DOM.scry(src,'tr');for(var
ii=0;ii<rows.length;ii++){if(JX.DOM.findAbove(rows[ii],'table')!==src){continue;}if(before){dst.insertBefore(rows[ii],before);}else{dst.appendChild(rows[ii]);}}},_getViewParameters:function(state){var
parameters={ref:this._ref,device:this._getDefaultDeviceRenderer()};if(state){JX.copy(parameters,state);}return parameters;},getRoutable:function(){return JX.Router.getInstance().getRoutableByKey(this._getRoutableKey());},getRendererKey:function(){return this._rendererKey;},_getDefaultDeviceRenderer:function(){return(JX.Device.getDevice()=='desktop')?'2up':'1up';},getUndoTemplates:function(){return this._undoTemplates;},getCharacterEncoding:function(){return this._characterEncoding;},getHighlight:function(){return this._highlight;},getRequestDocumentEngineKey:function(){return this._requestDocumentEngineKey;},getResponseDocumentEngineKey:function(){return this._responseDocumentEngineKey;},getAvailableDocumentEngineKeys:function(){return this._availableDocumentEngineKeys;},getSelectableItems:function(){var
items=[];items.push({type:'file',changeset:this,target:this,nodes:{begin:this._node,end:null}});if(!this._visible){return items;}var
rows=JX.DOM.scry(this._node,'tr');var
blocks=[];var
block;var
ii;var
parent_node=null;for(ii=0;ii<rows.length;ii++){var
type=this._getRowType(rows[ii]);if(parent_node===null){parent_node=rows[ii].parentNode;}if(type!==null){if(rows[ii].parentNode!==parent_node){type=null;}}if(!block||(block.type!==type)){block={type:type,items:[]};blocks.push(block);}block.items.push(rows[ii]);}var
last_inline=null;var
last_inline_item=null;for(ii=0;ii<blocks.length;ii++){block=blocks[ii];if(block.type=='change'){items.push({type:block.type,changeset:this,target:block.items[0],nodes:{begin:block.items[0],end:block.items[block.items.length-1]}});}if(block.type=='comment'){for(var
jj=0;jj<block.items.length;jj++){var
inline=this.getInlineForRow(block.items[jj]);if(inline===last_inline){last_inline_item.nodes.begin=block.items[jj];last_inline_item.nodes.end=block.items[jj];continue;}else{last_inline=inline;}var
is_saved=(!inline.isDraft()&&!inline.isEditing());last_inline_item={type:block.type,changeset:this,target:inline,hidden:inline.isHidden(),collapsed:inline.isCollapsed(),deleted:!inline.getID()&&!inline.isEditing(),nodes:{begin:block.items[jj],end:block.items[jj]},attributes:{unsaved:inline.isEditing(),anyDraft:inline.isDraft()||inline.isDraftDone(),undone:(is_saved&&!inline.isDone()),done:(is_saved&&inline.isDone())}};items.push(last_inline_item);}}}return items;},_getRowType:function(row){if(row.className.indexOf('inline')!==-1){return'comment';}var
cells=JX.DOM.scry(row,'td');for(var
ii=0;ii<cells.length;ii++){if(cells[ii].className.indexOf('old')!==-1||cells[ii].className.indexOf('new')!==-1){return'change';}}},_getNodeData:function(){return JX.Stratcom.getData(this._node);},getVectors:function(){return{pos:JX.$V(this._node),dim:JX.Vector.getDim(this._node)};},_onresponse:function(sequence,response){if(sequence!=this._sequence){return;}var
target=this._node;var
old_pos=JX.Vector.getScroll();var
old_view=JX.Vector.getViewport();var
old_dim=JX.Vector.getDocument();var
sticky=480;var
near_top=(old_pos.y<=sticky);var
near_bot=((old_pos.y+old_view.y)>=(old_dim.y-sticky));if(window.location.hash){near_bot=false;}var
target_pos=JX.Vector.getPos(target);var
target_dim=JX.Vector.getDim(target);var
target_bot=(target_pos.y+target_dim.y);var
above_screen=(target_bot<old_pos.y+64);var
on_target=null;if(window.location.hash){try{var
anchor=JX.$(window.location.hash.replace('#',''));if(anchor){var
anchor_pos=JX.$V(anchor);if((anchor_pos.y>old_pos.y)&&(anchor_pos.y<old_pos.y+96)){on_target=anchor;}}}catch(ignored){}}var
frame=this._getContentFrame();JX.DOM.setContent(frame,JX.$H(response.changeset));if(this._stabilize){if(on_target){JX.DOM.scrollToPosition(old_pos.x,JX.$V(on_target).y-60);}else
if(!near_top){if(near_bot||above_screen){var
delta=(JX.Vector.getDocument().y-old_dim.y);JX.DOM.scrollToPosition(old_pos.x,old_pos.y+delta);}}this._stabilize=false;}this._onchangesetresponse(response);},_onchangesetresponse:function(response){this._loadChangesetState(response);this._rebuildAllInlines();JX.Stratcom.invoke('resize');},_loadChangesetState:function(state){if(state.coverage){for(var
k
in
state.coverage){try{JX.DOM.replace(JX.$(k),JX.$H(state.coverage[k]));}catch(ignored){}}}if(state.undoTemplates){this._undoTemplates=state.undoTemplates;}this._rendererKey=state.rendererKey;this._highlight=state.highlight;this._characterEncoding=state.characterEncoding;this._requestDocumentEngineKey=state.requestDocumentEngineKey;this._responseDocumentEngineKey=state.responseDocumentEngineKey;this._availableDocumentEngineKeys=state.availableDocumentEngineKeys;this._isHidden=state.isHidden;var
is_hidden=!this.isVisible();if(this._isHidden!=is_hidden){this.setVisible(!this._isHidden);}this._isLoading=false;this.getPathView().setIsLoading(this._isLoading);},_getContentFrame:function(){return JX.DOM.find(this._node,'div','changeset-view-content');},_getRoutableKey:function(){return'changeset-view.'+this._ref+'.'+this._sequence;},getInlineForRow:function(node){var
data=JX.Stratcom.getData(node);if(!data.inline){var
inline=this._newInlineForRow(node);this.getInlines().push(inline);}return data.inline;},_newInlineForRow:function(node){return new
JX.DiffInline().setChangeset(this).bindToRow(node);},newInlineForRange:function(origin,target,options){var
list=this.getChangesetList();var
src=list.getLineNumberFromHeader(origin);var
dst=list.getLineNumberFromHeader(target);var
changeset_id=null;var
side=list.getDisplaySideFromHeader(origin);if(side=='right'){changeset_id=this.getRightChangesetID();}else{changeset_id=this.getLeftChangesetID();}var
is_new=false;if(side=='right'){is_new=true;}else
if(this.getRightChangesetID()!=this.getLeftChangesetID()){is_new=true;}var
data={origin:origin,target:target,number:src,length:dst-src,changesetID:changeset_id,displaySide:side,isNewFile:is_new};JX.copy(data,options||{});var
inline=new
JX.DiffInline().setChangeset(this).bindToRange(data);this.getInlines().push(inline);inline.create();return inline;},newInlineReply:function(original,state){var
inline=new
JX.DiffInline().setChangeset(this).bindToReply(original);this._inlines.push(inline);inline.create(state);return inline;},getInlineByID:function(id){return this._queryInline('id',id);},getInlineByPHID:function(phid){return this._queryInline('phid',phid);},_queryInline:function(field,value){var
inline=this._findInline(field,value);if(inline){return inline;}this._rebuildAllInlines();return this._findInline(field,value);},_findInline:function(field,value){var
inlines=this.getInlines();for(var
ii=0;ii<inlines.length;ii++){var
inline=inlines[ii];var
target;switch(field){case'id':target=inline.getID();break;case'phid':target=inline.getPHID();break;}if(target==value){return inline;}}return null;},getInlines:function(){if(this._inlines===null){this._rebuildAllInlines();}return this._inlines;},_rebuildAllInlines:function(){this._inlines=[];var
rows=JX.DOM.scry(this._node,'tr');var
ii;for(ii=0;ii<rows.length;ii++){var
row=rows[ii];if(this._getRowType(row)!='comment'){continue;}this._inlines.push(this._newInlineForRow(row));}},redrawFileTree:function(){var
inlines=this.getInlines();var
done=[];var
undone=[];var
inline;for(var
ii=0;ii<inlines.length;ii++){inline=inlines[ii];if(inline.isDeleted()){continue;}if(inline.isUndo()){continue;}if(inline.isSynthetic()){continue;}if(inline.isEditing()){continue;}if(!inline.getID()){continue;}if(inline.isDraft()){continue;}if(!inline.isDone()){undone.push(inline);}else{done.push(inline);}}var
total=done.length+undone.length;var
hint;var
is_visible;var
is_completed;if(total){if(done.length){hint=[done.length,'/',total];}else{hint=total;}is_visible=true;is_completed=(done.length==total);}else{hint='-';is_visible=false;is_completed=false;}var
node=this.getPathView().getInlineNode();JX.DOM.setContent(node,hint);JX.DOM.alterClass(node,'diff-tree-path-inlines-visible',is_visible);JX.DOM.alterClass(node,'diff-tree-path-inlines-completed',is_completed);},_onClickHeader:function(e){var
path_name=e.getNode('changeset-header-path-name');if(path_name){return;}if(e.getType()==='selectstart'){e.kill();return;}if(this._isSelected){this.getChangesetList().selectChangeset(null);}else{this.select(false);}},toggleVisibility:function(){this.setVisible(!this._visible);var
attrs={hidden:this.isVisible()?0:1,discard:1};var
workflow=this._newReloadWorkflow(attrs).setHandler(JX.bag);this._startContentWorkflow(workflow);},setVisible:function(visible){this._visible=visible;var
diff=this._getDiffNode();var
options=this._getViewButtonNode();var
show=this._getShowButtonNode();if(this._visible){JX.DOM.show(diff);JX.DOM.show(options);JX.DOM.hide(show);}else{JX.DOM.hide(diff);JX.DOM.hide(options);JX.DOM.show(show);if(this._viewMenu){this._viewMenu.close();}}JX.Stratcom.invoke('resize');var
node=this._node;JX.DOM.alterClass(node,'changeset-content-hidden',!this._visible);this.getPathView().setIsHidden(!this._visible);},setIsSelected:function(is_selected){this._isSelected=!!is_selected;var
node=this._node;JX.DOM.alterClass(node,'changeset-selected',this._isSelected);return this;},_getDiffNode:function(){if(!this._diffNode){this._diffNode=JX.DOM.find(this._node,'table','differential-diff');}return this._diffNode;},_getViewButtonNode:function(){if(!this._viewButtonNode){this._viewButtonNode=JX.DOM.find(this._node,'a','differential-view-options');}return this._viewButtonNode;},_getShowButtonNode:function(){if(!this._showButtonNode){var
pht=this.getChangesetList().getTranslations();var
show_button=new
JX.PHUIXButtonView().setIcon('fa-angle-double-down').setText(pht('Show Changeset')).setColor('grey');var
button_node=show_button.getNode();this._getViewButtonNode().parentNode.appendChild(button_node);var
onshow=JX.bind(this,this._onClickShowButton);JX.DOM.listen(button_node,'click',null,onshow);this._showButtonNode=button_node;}return this._showButtonNode;},_onClickShowButton:function(e){e.prevent();this.toggleVisibility();},isVisible:function(){return this._visible;},getPathView:function(){if(!this._pathView){var
view=new
JX.DiffPathView().setChangeset(this).setPath(this._pathParts).setIsLowImportance(this._isLowImportance).setIsOwned(this._isOwned).setIsLoading(this._isLoading);view.getIcon().setIcon(this._pathIconIcon).setColor(this._pathIconColor);this._pathView=view;}return this._pathView;},select:function(scroll){this.getChangesetList().selectChangeset(this,scroll);return this;}},statics:{getForNode:function(node){var
data=JX.Stratcom.getData(node);if(!data.changesetViewManager){data.changesetViewManager=new
JX.DiffChangeset(node);}return data.changesetViewManager;}}});JX.install('DiffChangesetList',{construct:function(){this._changesets=[];var
onload=JX.bind(this,this._ifawake,this._onload);JX.Stratcom.listen('click','differential-load',onload);var
onmore=JX.bind(this,this._ifawake,this._onmore);JX.Stratcom.listen('click','show-more',onmore);var
onmenu=JX.bind(this,this._ifawake,this._onmenu);JX.Stratcom.listen('click','differential-view-options',onmenu);var
onexpand=JX.bind(this,this._ifawake,this._oncollapse,false);JX.Stratcom.listen('click','reveal-inline',onexpand);var
onresize=JX.bind(this,this._ifawake,this._onresize);JX.Stratcom.listen('resize',null,onresize);var
onscroll=JX.bind(this,this._ifawake,this._onscroll);JX.Stratcom.listen('scroll',null,onscroll);JX.enableDispatch(window,'selectstart');var
onselect=JX.bind(this,this._ifawake,this._onselect);JX.Stratcom.listen(['mousedown','selectstart'],['differential-inline-comment','differential-inline-header'],onselect);var
onhover=JX.bind(this,this._ifawake,this._onhover);JX.Stratcom.listen(['mouseover','mouseout'],'differential-inline-comment',onhover);var
onrangedown=JX.bind(this,this._ifawake,this._onrangedown);JX.Stratcom.listen('mousedown',['differential-changeset','tag:td'],onrangedown);var
onrangemove=JX.bind(this,this._ifawake,this._onrangemove);JX.Stratcom.listen(['mouseover','mouseout'],['differential-changeset','tag:td'],onrangemove);var
onrangeup=JX.bind(this,this._ifawake,this._onrangeup);JX.Stratcom.listen('mouseup',null,onrangeup);var
onrange=JX.bind(this,this._ifawake,this._onSelectRange);JX.enableDispatch(window,'selectionchange');JX.Stratcom.listen('selectionchange',null,onrange);this._setupInlineCommentListeners();},properties:{translations:null,inlineURI:null,inlineListURI:null,isStandalone:false,formationView:null},members:{_initialized:false,_asleep:true,_changesets:null,_cursorItem:null,_focusNode:null,_focusStart:null,_focusEnd:null,_hoverInline:null,_hoverOrigin:null,_hoverTarget:null,_rangeActive:false,_rangeOrigin:null,_rangeTarget:null,_bannerNode:null,_unsavedButton:null,_unsubmittedButton:null,_doneButton:null,_doneMode:null,_dropdownMenu:null,_menuButton:null,_menuItems:null,_selectedChangeset:null,sleep:function(){this._asleep=true;this._redrawFocus();this._redrawSelection();this.resetHover();this._bannerChangeset=null;this._redrawBanner();},wake:function(){this._asleep=false;this._redrawFocus();this._redrawSelection();this._bannerChangeset=null;this._redrawBanner();this._redrawFiletree();if(this._initialized){return;}this._initialized=true;var
pht=this.getTranslations();var
standalone=this.getIsStandalone();var
label;if(!standalone){label=pht('Jump to the table of contents.');this._installKey('t','diff-nav',label,this._ontoc);label=pht('Jump to the comment area.');this._installKey('x','diff-nav',label,this._oncomments);}label=pht('Jump to next change.');this._installJumpKey('j',label,1);label=pht('Jump to previous change.');this._installJumpKey('k',label,-1);if(!standalone){label=pht('Jump to next file.');this._installJumpKey('J',label,1,'file');label=pht('Jump to previous file.');this._installJumpKey('K',label,-1,'file');}label=pht('Jump to next inline comment.');this._installJumpKey('n',label,1,'comment');label=pht('Jump to previous inline comment.');this._installJumpKey('p',label,-1,'comment');label=pht('Jump to next inline comment, including collapsed comments.');this._installJumpKey('N',label,1,'comment',true);label=pht('Jump to previous inline comment, including collapsed comments.');this._installJumpKey('P',label,-1,'comment',true);var
formation=this.getFormationView();if(formation){var
filetree=formation.getColumn(0);var
toggletree=JX.bind(filetree,filetree.toggleVisibility);label=pht('Hide or show the paths panel.');this._installKey('f','diff-vis',label,toggletree);}if(!standalone){label=pht('Hide or show the current changeset.');this._installKey('h','diff-vis',label,this._onkeytogglefile);}label=pht('Reply to selected inline comment or change.');this._installKey('r','inline',label,JX.bind(this,this._onkeyreply,false));label=pht('Reply and quote selected inline comment.');this._installKey('R','inline',label,JX.bind(this,this._onkeyreply,true));label=pht('Add new inline comment on selected source text.');this._installKey('c','inline',label,JX.bind(this,this._onKeyCreate));label=pht('Edit selected inline comment.');this._installKey('e','inline',label,this._onkeyedit);label=pht('Mark or unmark selected inline comment as done.');this._installKey('w','inline',label,this._onkeydone);label=pht('Collapse or expand inline comment.');this._installKey('q','diff-vis',label,this._onkeycollapse);label=pht('Hide or show all inline comments.');this._installKey('A','diff-vis',label,this._onkeyhideall);label=pht('Show path in repository.');this._installKey('d','diff-nav',label,this._onkeyshowpath);label=pht('Show directory in repository.');this._installKey('D','diff-nav',label,this._onkeyshowdirectory);label=pht('Open file in external editor.');this._installKey('\\','diff-nav',label,this._onkeyopeneditor);},isAsleep:function(){return this._asleep;},newChangesetForNode:function(node){var
changeset=JX.DiffChangeset.getForNode(node);this._changesets.push(changeset);changeset.setChangesetList(this);return changeset;},getChangesetForNode:function(node){return JX.DiffChangeset.getForNode(node);},getInlineByID:function(id){var
inline=null;for(var
ii=0;ii<this._changesets.length;ii++){inline=this._changesets[ii].getInlineByID(id);if(inline){break;}}return inline;},_ifawake:function(f){if(this.isAsleep()){return;}return f.apply(this,[].slice.call(arguments,1));},_onload:function(e){var
data=e.getNodeData('differential-load');if(data.kill){e.kill();}var
node=JX.$(data.id);var
changeset=this.getChangesetForNode(node);changeset.load();var
routable=changeset.getRoutable();if(routable){routable.setPriority(2000);}},_installKey:function(key,group,label,handler){handler=JX.bind(this,this._ifawake,handler);return new
JX.KeyboardShortcut(key,label).setHandler(handler).setGroup(group).register();},_installJumpKey:function(key,label,delta,filter,show_collapsed){filter=filter||null;var
options={filter:filter,collapsed:show_collapsed};var
handler=JX.bind(this,this._onjumpkey,delta,options);return this._installKey(key,'diff-nav',label,handler);},_ontoc:function(manager){var
toc=JX.$('toc');manager.scrollTo(toc);},_oncomments:function(manager){var
reply=JX.$('reply');manager.scrollTo(reply);},getSelectedInline:function(){var
cursor=this._cursorItem;if(cursor){if(cursor.type=='comment'){return cursor.target;}}return null;},_onkeyreply:function(is_quote){var
cursor=this._cursorItem;if(cursor){if(cursor.type=='comment'){var
inline=cursor.target;if(inline.canReply()){this.setFocus(null);inline.reply(is_quote);return;}}if(cursor.type=='change'){var
cells=this._getLineNumberCellsForChangeBlock(cursor.nodes.begin,cursor.nodes.end);cursor.changeset.newInlineForRange(cells.src,cells.dst);this.setFocus(null);return;}}var
pht=this.getTranslations();this._warnUser(pht('You must select a comment or change to reply to.'));},_getLineNumberCellsForChangeBlock:function(origin,target){var
old_list=[];var
new_list=[];var
row=origin;while(row){var
header=row.firstChild;while(header){if(this.getLineNumberFromHeader(header)){if(header.className.indexOf('old')!==-1){old_list.push(header);}else
if(header.className.indexOf('new')!==-1){new_list.push(header);}}header=header.nextSibling;}if(row==target){break;}row=row.nextSibling;}var
use_list;if(new_list.length){use_list=new_list;}else{use_list=old_list;}var
src=use_list[0];var
dst=use_list[use_list.length-1];return{src:src,dst:dst};},_onkeyedit:function(){var
cursor=this._cursorItem;if(cursor){if(cursor.type=='comment'){var
inline=cursor.target;if(inline.canEdit()){this.setFocus(null);inline.edit();return;}}}var
pht=this.getTranslations();this._warnUser(pht('You must select a comment to edit.'));},_onKeyCreate:function(){var
start=this._sourceSelectionStart;var
end=this._sourceSelectionEnd;if(!this._sourceSelectionStart){var
pht=this.getTranslations();this._warnUser(pht('You must select source text to create a new inline comment.'));return;}this._setSourceSelection(null,null);var
changeset=start.changeset;var
config={};if(changeset.getResponseDocumentEngineKey()===null){config.startOffset=start.offset;config.endOffset=end.offset;}changeset.newInlineForRange(start.targetNode,end.targetNode,config);},_onkeydone:function(){var
cursor=this._cursorItem;if(cursor){if(cursor.type=='comment'){var
inline=cursor.target;if(inline.canDone()){this.setFocus(null);inline.toggleDone();return;}}}var
pht=this.getTranslations();this._warnUser(pht('You must select a comment to mark done.'));},_onkeytogglefile:function(){var
pht=this.getTranslations();var
changeset=this._getChangesetForKeyCommand();if(!changeset){this._warnUser(pht('You must select a file to hide or show.'));return;}changeset.toggleVisibility();},_getChangesetForKeyCommand:function(){var
cursor=this._cursorItem;var
changeset;if(cursor){changeset=cursor.changeset;}if(!changeset){changeset=this._getVisibleChangeset();}return changeset;},_onkeyopeneditor:function(e){var
pht=this.getTranslations();var
changeset=this._getChangesetForKeyCommand();if(!changeset){this._warnUser(pht('You must select a file to edit.'));return;}this._openEditor(changeset);},_openEditor:function(changeset){var
pht=this.getTranslations();var
editor_template=changeset.getEditorURITemplate();if(editor_template===null){this._warnUser(pht('No external editor is configured.'));return;}var
line=null;if(changeset.getResponseDocumentEngineKey()===null){var
cursor=this._cursorItem;if(cursor&&(cursor.changeset===changeset)){if(cursor.type=='change'){var
cells=this._getLineNumberCellsForChangeBlock(cursor.nodes.begin,cursor.nodes.end);line=this.getLineNumberFromHeader(cells.src);}if(cursor.type==='comment'){var
inline=cursor.target;line=inline.getLineNumber();}}}var
variables={l:line||1};var
editor_uri=new
JX.ExternalEditorLinkEngine().setTemplate(editor_template).setVariables(variables).newURI();JX.$U(editor_uri).go();},_onkeyshowpath:function(){this._onrepositorykey(false);},_onkeyshowdirectory:function(){this._onrepositorykey(true);},_onrepositorykey:function(is_directory){var
pht=this.getTranslations();var
changeset=this._getChangesetForKeyCommand();if(!changeset){this._warnUser(pht('You must select a file to open.'));return;}var
show_uri;if(is_directory){show_uri=changeset.getShowDirectoryURI();}else{show_uri=changeset.getShowPathURI();}if(show_uri===null){return;}window.open(show_uri);},_onkeycollapse:function(){var
cursor=this._cursorItem;if(cursor){if(cursor.type=='comment'){var
inline=cursor.target;if(inline.canCollapse()){this.setFocus(null);inline.setCollapsed(!inline.isCollapsed());return;}}}var
pht=this.getTranslations();this._warnUser(pht('You must select a comment to hide.'));},_onkeyhideall:function(){var
inlines=this._getInlinesByType();if(inlines.visible.length){this._toggleInlines('all');}else{this._toggleInlines('show');}},_warnUser:function(message){new
JX.Notification().setContent(message).alterClassName('jx-notification-alert',true).setDuration(3000).show();},_onjumpkey:function(delta,options){var
state=this._getSelectionState();var
filter=options.filter||null;var
collapsed=options.collapsed||false;var
wrap=options.wrap||false;var
attribute=options.attribute||null;var
show=options.show||false;var
cursor=state.cursor;var
items=state.items;if((cursor===null)&&(delta<0)){return;}var
did_wrap=false;while(true){if(cursor===null){cursor=0;}else{cursor=cursor+delta;}if(cursor<0){return;}if(cursor>=items.length){if(!wrap){return;}if(did_wrap){return;}cursor=0;did_wrap=true;}if(filter!==null){if(items[cursor].type!==filter){continue;}}if(!collapsed){if(items[cursor].collapsed){continue;}}if(items[cursor].deleted){continue;}if(attribute!==null){if(!(items[cursor].attributes||{})[attribute]){continue;}}if(items[cursor].hidden){if(!show){continue;}items[cursor].target.setHidden(false);}break;}this._setSelectionState(items[cursor],true);},_getSelectionState:function(){var
items=this._getSelectableItems();var
cursor=null;if(this._cursorItem!==null){for(var
ii=0;ii<items.length;ii++){var
item=items[ii];if(this._cursorItem.target===item.target){cursor=ii;break;}}}return{cursor:cursor,items:items};},selectChangeset:function(changeset,scroll){var
items=this._getSelectableItems();var
cursor=null;for(var
ii=0;ii<items.length;ii++){var
item=items[ii];if(changeset===item.target){cursor=ii;break;}}if(cursor!==null){this._setSelectionState(items[cursor],scroll);}else{this._setSelectionState(null,false);}return this;},_setSelectionState:function(item,scroll){var
old=this._cursorItem;if(old){if(old.type==='comment'){old.target.setIsSelected(false);}}this._cursorItem=item;if(item){if(item.type==='comment'){item.target.setIsSelected(true);}}this._redrawSelection(scroll);return this;},_redrawSelection:function(scroll){var
cursor=this._cursorItem;if(!cursor){this.setFocus(null);return;}if(cursor.deleted){this.setFocus(null);return;}var
changeset=cursor.changeset;var
tree=this._getTreeView();if(changeset){tree.setSelectedPath(cursor.changeset.getPathView());}else{tree.setSelectedPath(null);}this._selectChangeset(changeset);this.setFocus(cursor.nodes.begin,cursor.nodes.end);if(scroll){var
pos=JX.$V(cursor.nodes.begin);JX.DOM.scrollToPosition(0,pos.y-60);}return this;},redrawCursor:function(){var
state=this._getSelectionState();if(state.cursor!==null){this._setSelectionState(state.items[state.cursor],false);}},_getSelectableItems:function(){var
result=[];for(var
ii=0;ii<this._changesets.length;ii++){var
items=this._changesets[ii].getSelectableItems();for(var
jj=0;jj<items.length;jj++){result.push(items[jj]);}}return result;},_onhover:function(e){if(e.getIsTouchEvent()){return;}var
inline;if(e.getType()=='mouseout'){inline=null;}else{inline=this._getInlineForEvent(e);}this._setHoverInline(inline);},_onmore:function(e){e.kill();var
node=e.getNode('differential-changeset');var
changeset=this.getChangesetForNode(node);var
data=e.getNodeData('show-more');var
target=e.getNode('context-target');changeset.loadContext(data.range,target);},_onmenu:function(e){var
button=e.getNode('differential-view-options');var
data=JX.Stratcom.getData(button);if(data.menu){return;}e.prevent();var
pht=this.getTranslations();var
node=JX.DOM.findAbove(button,'div','differential-changeset');var
changeset_list=this;var
changeset=this.getChangesetForNode(node);var
menu=new
JX.PHUIXDropdownMenu(button).setWidth(240);var
list=new
JX.PHUIXActionListView();var
add_link=function(icon,name,href,local){var
link=new
JX.PHUIXActionView().setIcon(icon).setName(name).setHandler(function(e){if(local){window.location.assign(href);}else{window.open(href);}menu.close();e.prevent();});if(href){link.setHref(href);}else{link.setDisabled(true).setUnresponsive(true);}list.addItem(link);return link;};var
visible_item=new
JX.PHUIXActionView().setKeyCommand('h').setHandler(function(e){e.prevent();menu.close();changeset.select(false);changeset.toggleVisibility();});list.addItem(visible_item);var
reveal_item=new
JX.PHUIXActionView().setIcon('fa-eye');list.addItem(reveal_item);list.addItem(new
JX.PHUIXActionView().setDivider(true));var
up_item=new
JX.PHUIXActionView().setHandler(function(e){if(changeset.isLoaded()){var
inlines=changeset.getInlines();for(var
ii=0;ii<inlines.length;ii++){if(inlines[ii].isEditing()){changeset_list._warnUser(pht('Finish editing inline comments before changing display '+'modes.'));e.prevent();menu.close();return;}}var
renderer=changeset.getRendererKey();if(renderer=='1up'){renderer='2up';}else{renderer='1up';}changeset.reload({renderer:renderer});}else{changeset.reload();}e.prevent();menu.close();});list.addItem(up_item);var
encoding_item=new
JX.PHUIXActionView().setIcon('fa-font').setName(pht('Change Text Encoding...')).setHandler(function(e){var
params={encoding:changeset.getCharacterEncoding()};new
JX.Workflow('/services/encoding/',params).setHandler(function(r){changeset.reload({encoding:r.encoding});}).start();e.prevent();menu.close();});list.addItem(encoding_item);var
highlight_item=new
JX.PHUIXActionView().setIcon('fa-sun-o').setName(pht('Highlight As...')).setHandler(function(e){var
params={highlight:changeset.getHighlight()};new
JX.Workflow('/services/highlight/',params).setHandler(function(r){changeset.reload({highlight:r.highlight});}).start();e.prevent();menu.close();});list.addItem(highlight_item);var
engine_item=new
JX.PHUIXActionView().setIcon('fa-file-image-o').setName(pht('View As Document Type...')).setHandler(function(e){var
options=changeset.getAvailableDocumentEngineKeys()||[];options=options.join(',');var
params={engine:changeset.getResponseDocumentEngineKey(),options:options};new
JX.Workflow('/services/viewas/',params).setHandler(function(r){changeset.reload({engine:r.engine});}).start();e.prevent();menu.close();});list.addItem(engine_item);list.addItem(new
JX.PHUIXActionView().setDivider(true));add_link('fa-external-link',pht('View Standalone'),data.standaloneURI);add_link('fa-arrow-left',pht('Show Raw File (Left)'),data.leftURI);add_link('fa-arrow-right',pht('Show Raw File (Right)'),data.rightURI);add_link('fa-folder-open-o',pht('Show Directory in Repository'),changeset.getShowDirectoryURI()).setKeyCommand('D');add_link('fa-file-text-o',pht('Show Path in Repository'),changeset.getShowPathURI()).setKeyCommand('d');var
editor_template=changeset.getEditorURITemplate();if(editor_template!==null){var
editor_item=new
JX.PHUIXActionView().setIcon('fa-i-cursor').setName(pht('Open in Editor')).setKeyCommand('\\').setHandler(function(e){changeset_list._openEditor(changeset);e.prevent();menu.close();});list.addItem(editor_item);}else{var
configure_uri=changeset.getEditorConfigureURI();if(configure_uri!==null){add_link('fa-wrench',pht('Configure Editor'),configure_uri);}}menu.setContent(list.getNode());menu.listen('open',function(){var
nodes=JX.DOM.scry(JX.$(data.containerID),'a','show-more');if(nodes.length){reveal_item.setDisabled(false).setName(pht('Show All Context')).setIcon('fa-arrows-v').setHandler(function(e){changeset.loadAllContext();e.prevent();menu.close();});}else{reveal_item.setDisabled(true).setUnresponsive(true).setIcon('fa-file').setName(pht('All Context Shown')).setHref(null);}encoding_item.setDisabled(!changeset.isLoaded());highlight_item.setDisabled(!changeset.isLoaded());engine_item.setDisabled(!changeset.isLoaded());if(changeset.isLoaded()){if(changeset.getRendererKey()=='2up'){up_item.setIcon('fa-list-alt').setName(pht('View Unified Diff'));}else{up_item.setIcon('fa-columns').setName(pht('View Side-by-Side Diff'));}}else{up_item.setIcon('fa-refresh').setName(pht('Load Changes'));}visible_item.setDisabled(true).setIcon('fa-eye-slash').setName(pht('Hide Changeset'));var
diffs=JX.DOM.scry(JX.$(data.containerID),'table','differential-diff');if(diffs.length>1){JX.$E('More than one node with sigil "differential-diff" was found in "'+data.containerID+'."');}else
if(diffs.length==1){visible_item.setDisabled(false);}else{}});data.menu=menu;changeset.setViewMenu(menu);menu.open();},_oncollapse:function(is_collapse,e){e.kill();var
inline=this._getInlineForEvent(e);inline.setCollapsed(is_collapse);},_onresize:function(){this._redrawFocus();this._redrawSelection();this._bannerChangeset=null;this._redrawBanner();var
changesets=this._changesets;for(var
ii=0;ii<changesets.length;ii++){changesets[ii].redrawFileTree();}},_onscroll:function(){this._redrawBanner();},_onselect:function(e){if(e.getTarget()!==e.getNode('differential-inline-header')){return;}if(e.getType()==='selectstart'){e.kill();return;}var
inline=this._getInlineForEvent(e);if(!inline){return;}this.selectInline(inline);},selectInline:function(inline,force,scroll){var
selection=this._getSelectionState();var
item;if(!force){if(selection.cursor!==null){item=selection.items[selection.cursor];if(item.target===inline){this._setSelectionState(null,false);return;}}}var
items=selection.items;for(var
ii=0;ii<items.length;ii++){item=items[ii];if(item.target===inline){this._setSelectionState(item,scroll);}}},redrawPreview:function(){var
forms=JX.DOM.scry(document.body,'form','transaction-append');if(forms.length){JX.DOM.invoke(forms[0],'shouldRefresh');}this.resetHover();},setFocus:function(node,extended_node){if(!node){var
tree=this._getTreeView();tree.setSelectedPath(null);this._selectChangeset(null);}this._focusStart=node;this._focusEnd=extended_node;this._redrawFocus();},_selectChangeset:function(changeset){if(this._selectedChangeset===changeset){return;}if(this._selectedChangeset!==null){this._selectedChangeset.setIsSelected(false);this._selectedChangeset=null;}this._selectedChangeset=changeset;if(this._selectedChangeset!==null){this._selectedChangeset.setIsSelected(true);}},_redrawFocus:function(){var
node=this._focusStart;var
extended_node=this._focusEnd||node;var
reticle=this._getFocusNode();if(!node||this.isAsleep()){JX.DOM.remove(reticle);return;}var
p=JX.Vector.getPos(node);var
s=JX.Vector.getAggregateScrollForNode(node);var
d=JX.Vector.getDim(node);p.add(s).add(d.x+1,4).setPos(reticle);JX.Vector.getPos(extended_node).add(-p.x,-p.y).add(0,JX.Vector.getDim(extended_node).y).add(10,-4).setDim(reticle);JX.DOM.getContentFrame().appendChild(reticle);},_getFocusNode:function(){if(!this._focusNode){var
node=JX.$N('div',{className:'keyboard-focus-focus-reticle'});this._focusNode=node;}return this._focusNode;},_setHoverInline:function(inline){var
origin=null;var
target=null;if(inline){var
changeset=inline.getChangeset();var
changeset_id;var
side=inline.getDisplaySide();if(side=='right'){changeset_id=changeset.getRightChangesetID();}else{changeset_id=changeset.getLeftChangesetID();}var
new_part;if(inline.isNewFile()){new_part='N';}else{new_part='O';}var
prefix='C'+changeset_id+new_part+'L';var
number=inline.getLineNumber();var
length=inline.getLineLength();try{origin=JX.$(prefix+number);target=JX.$(prefix+(number+length));}catch(error){origin=null;target=null;}}this._setHoverRange(origin,target,inline);},_setHoverRange:function(origin,target,inline){inline=inline||null;var
origin_dirty=(origin!==this._hoverOrigin);var
target_dirty=(target!==this._hoverTarget);var
inline_dirty=(inline!==this._hoverInline);var
any_dirty=(origin_dirty||target_dirty||inline_dirty);if(any_dirty){this._hoverOrigin=origin;this._hoverTarget=target;this._hoverInline=inline;this._redrawHover();}},resetHover:function(){this._setHoverRange(null,null,null);},_redrawHover:function(){var
map=this._hoverMap;if(map){this._hoverMap=null;this._applyHoverHighlight(map,false);}var
rows=this._hoverRows;if(rows){this._hoverRows=null;this._applyHoverHighlight(rows,false);}if(!this._hoverOrigin||this.isAsleep()){return;}var
top=this._hoverOrigin;var
bot=this._hoverTarget;if(JX.$V(top).y>JX.$V(bot).y){var
tmp=top;top=bot;bot=tmp;}var
content_cell=top;while(content_cell&&!this._isContentCell(content_cell)){content_cell=content_cell.nextSibling;}if(!content_cell){return;}rows=this._findContentCells(top,bot,content_cell);var
inline=this._hoverInline;if(!inline){this._hoverRows=rows;this._applyHoverHighlight(this._hoverRows,true);return;}if(!inline.hoverMap){inline.hoverMap=this._newHoverMap(rows,inline);}this._hoverMap=inline.hoverMap;this._applyHoverHighlight(this._hoverMap,true);},_applyHoverHighlight:function(items,on){for(var
ii=0;ii<items.length;ii++){var
item=items[ii];JX.DOM.alterClass(item.lineNode,'inline-hover',on);JX.DOM.alterClass(item.cellNode,'inline-hover',on);if(item.bright){JX.DOM.alterClass(item.cellNode,'inline-hover-bright',on);}if(item.hoverNode){if(on){item.cellNode.insertBefore(item.hoverNode,item.cellNode.firstChild);}else{JX.DOM.remove(item.hoverNode);}}}},_findContentCells:function(top,bot,content_cell){var
head_row=JX.DOM.findAbove(top,'tr');var
last_row=JX.DOM.findAbove(bot,'tr');var
cursor=head_row;var
rows=[];var
idx=null;var
ii;var
line_cell=null;do{line_cell=null;for(ii=0;ii<cursor.childNodes.length;ii++){var
child=cursor.childNodes[ii];if(!JX.DOM.isType(child,'td')){continue;}if(child.getAttribute('data-n')){line_cell=child;}if(child===content_cell){idx=ii;}if(ii!==idx){continue;}if(this._isContentCell(child)){rows.push({lineNode:line_cell,cellNode:child});}break;}if(cursor===last_row){break;}cursor=cursor.nextSibling;}while(cursor);return rows;},_newHoverMap:function(rows,inline){var
start=inline.getStartOffset();var
end=inline.getEndOffset();var
info;var
content;for(ii=0;ii<rows.length;ii++){info=this._getSelectionOffset(rows[ii].cellNode,null);content=info.content;content=content.replace(/\n+$/,'');rows[ii].content=content;}var
attr_dull={className:'inline-hover-text'};var
attr_bright={className:'inline-hover-text inline-hover-text-bright'};var
attr_container={className:'inline-hover-container'};var
min=0;var
max=rows.length-1;var
offset_min;var
offset_max;var
len;var
node;var
text;var
any_highlight=false;for(ii=0;ii<rows.length;ii++){content=rows[ii].content;len=content.length;if(ii===min&&(start!==null)){offset_min=start;}else{offset_min=0;}if(ii===max&&(end!==null)){offset_max=Math.min(end,len);}else{offset_max=len;}var
has_min=(offset_min>0);var
has_max=(offset_max<len);if(has_min||has_max){any_highlight=true;}rows[ii].min=offset_min;rows[ii].max=offset_max;rows[ii].hasMin=has_min;rows[ii].hasMax=has_max;}for(ii=0;ii<rows.length;ii++){content=rows[ii].content;offset_min=rows[ii].min;offset_max=rows[ii].max;var
has_highlight=(rows[ii].hasMin||rows[ii].hasMax);if(any_highlight){var
parts=[];if(offset_min>0){text=content.substring(0,offset_min);node=JX.$N('span',attr_dull,text);parts.push(node);}if(len){text=content.substring(offset_min,offset_max);node=JX.$N('span',attr_bright,text);parts.push(node);}if(offset_max<len){text=content.substring(offset_max,len);node=JX.$N('span',attr_dull,text);parts.push(node);}rows[ii].hoverNode=JX.$N('div',attr_container,parts);}else{rows[ii].hoverNode=null;}rows[ii].bright=(any_highlight&&!has_highlight);}return rows;},_deleteInlineByID:function(id){var
uri=this.getInlineURI();var
data={op:'refdelete',id:id};var
handler=JX.bind(this,this.redrawPreview);new
JX.Workflow(uri,data).setHandler(handler).start();},_getInlineForEvent:function(e){var
node=e.getNode('differential-changeset');if(!node){return null;}var
changeset=this.getChangesetForNode(node);var
inline_row=e.getNode('inline-row');return changeset.getInlineForRow(inline_row);},getLineNumberFromHeader:function(node){var
n=parseInt(node.getAttribute('data-n'));if(!n){return null;}try{JX.DOM.findAbove(node,'tr','context-target');return null;}catch(ex){}return n;},getDisplaySideFromHeader:function(th){return(th.parentNode.firstChild!=th)?'right':'left';},_onrangedown:function(e){if(!e.isLeftButton()){return;}if(this._rangeActive){return;}var
target=e.getTarget();var
number=this.getLineNumberFromHeader(target);if(!number){return;}e.kill();this._rangeActive=true;this._rangeOrigin=target;this._rangeTarget=target;this._setHoverRange(this._rangeOrigin,this._rangeTarget);},_onrangemove:function(e){if(e.getIsTouchEvent()){return;}var
is_out=(e.getType()=='mouseout');var
target=e.getTarget();this._updateRange(target,is_out);},_updateRange:function(target,is_out){var
number=this.getLineNumberFromHeader(target);if(!number){return;}if(this._rangeActive){var
origin=this._hoverOrigin;var
origin_side=this.getDisplaySideFromHeader(origin);var
target_side=this.getDisplaySideFromHeader(target);if(origin_side!=target_side){return;}var
origin_table=JX.DOM.findAbove(origin,'table');var
target_table=JX.DOM.findAbove(target,'table');if(origin_table!=target_table){return;}}if(is_out){if(this._rangeActive){}else{this.resetHover();}return;}if(this._rangeActive){this._rangeTarget=target;}else{this._rangeOrigin=target;this._rangeTarget=target;}this._setHoverRange(this._rangeOrigin,this._rangeTarget);},_onrangeup:function(e){if(!this._rangeActive){return;}e.kill();var
origin=this._rangeOrigin;var
target=this._rangeTarget;if(JX.$V(origin).y>JX.$V(target).y){var
tmp=target;target=origin;origin=tmp;}var
node=JX.DOM.findAbove(origin,null,'differential-changeset');var
changeset=this.getChangesetForNode(node);changeset.newInlineForRange(origin,target);this._rangeActive=false;this._rangeOrigin=null;this._rangeTarget=null;this.resetHover();},_redrawBanner:function(){if(this._dropdownMenu){this._dropdownMenu.close();}var
node=this._getBannerNode();var
changeset=this._getVisibleChangeset();var
tree=this._getTreeView();var
formation=this.getFormationView();if(!changeset){this._bannerChangeset=null;JX.DOM.remove(node);tree.setFocusedPath(null);if(formation){formation.repaint();}return;}if(this._bannerChangeset===changeset){return;}this._bannerChangeset=changeset;var
paths=tree.getPaths();for(var
ii=0;ii<paths.length;ii++){var
path=paths[ii];if(path.getChangeset()===changeset){tree.setFocusedPath(path);}}var
inlines=this._getInlinesByType();var
unsaved=inlines.unsaved;var
unsubmitted=inlines.unsubmitted;var
undone=inlines.undone;var
done=inlines.done;var
draft_done=inlines.draftDone;JX.DOM.alterClass(node,'diff-banner-has-unsaved',!!unsaved.length);JX.DOM.alterClass(node,'diff-banner-has-unsubmitted',!!unsubmitted.length);JX.DOM.alterClass(node,'diff-banner-has-draft-done',!!draft_done.length);var
pht=this.getTranslations();var
unsaved_button=this._getUnsavedButton();var
unsubmitted_button=this._getUnsubmittedButton();var
done_button=this._getDoneButton();var
menu_button=this._getMenuButton();if(unsaved.length){unsaved_button.setText(unsaved.length+' '+pht('Unsaved'));JX.DOM.show(unsaved_button.getNode());}else{JX.DOM.hide(unsaved_button.getNode());}if(unsubmitted.length||draft_done.length){var
any_draft_count=unsubmitted.length+draft_done.length;unsubmitted_button.setText(any_draft_count+' '+pht('Unsubmitted'));JX.DOM.show(unsubmitted_button.getNode());}else{JX.DOM.hide(unsubmitted_button.getNode());}if(done.length||undone.length){var
done_text;if(done.length){done_text=[done.length,' / ',(done.length+undone.length),' ',pht('Comments')];}else{done_text=[undone.length,' ',pht('Comments')];}done_button.setText(done_text);JX.DOM.show(done_button.getNode());if(undone.length){this._doneMode='undone';}else{this._doneMode='done';}}else{JX.DOM.hide(done_button.getNode());}var
path_view=[icon,' ',changeset.getDisplayPath()];var
buttons_attrs={className:'diff-banner-buttons'};var
buttons_list=[unsaved_button.getNode(),unsubmitted_button.getNode(),done_button.getNode(),menu_button.getNode()];var
buttons_view=JX.$N('div',buttons_attrs,buttons_list);var
icon=new
JX.PHUIXIconView().setIcon(changeset.getIcon()).getNode();JX.DOM.setContent(node,[buttons_view,path_view]);document.body.appendChild(node);if(formation){formation.repaint();}},_getInlinesByType:function(){var
changesets=this._changesets;var
unsaved=[];var
unsubmitted=[];var
undone=[];var
done=[];var
draft_done=[];var
visible_done=[];var
visible_collapsed=[];var
visible_ghosts=[];var
visible=[];var
hidden=[];for(var
ii=0;ii<changesets.length;ii++){var
inlines=changesets[ii].getInlines();var
inline;var
jj;for(jj=0;jj<inlines.length;jj++){inline=inlines[jj];if(inline.isDeleted()){continue;}if(inline.isSynthetic()){continue;}if(inline.isEditing()){unsaved.push(inline);}else
if(!inline.getID()){continue;}else
if(inline.isDraft()){unsubmitted.push(inline);}else{if(inline.isDraftDone()){draft_done.push(inline);}if(!inline.isDone()){undone.push(inline);}else{done.push(inline);}}}for(jj=0;jj<inlines.length;jj++){inline=inlines[jj];if(inline.isDeleted()){continue;}if(inline.isEditing()){continue;}if(inline.isHidden()){hidden.push(inline);continue;}visible.push(inline);if(inline.isDone()){visible_done.push(inline);}if(inline.isCollapsed()){visible_collapsed.push(inline);}if(inline.isGhost()){visible_ghosts.push(inline);}}}return{unsaved:unsaved,unsubmitted:unsubmitted,undone:undone,done:done,draftDone:draft_done,visibleDone:visible_done,visibleGhosts:visible_ghosts,visibleCollapsed:visible_collapsed,visible:visible,hidden:hidden};},_getUnsavedButton:function(){if(!this._unsavedButton){var
button=new
JX.PHUIXButtonView().setIcon('fa-commenting-o').setButtonType(JX.PHUIXButtonView.BUTTONTYPE_SIMPLE);var
node=button.getNode();var
onunsaved=JX.bind(this,this._onunsavedclick);JX.DOM.listen(node,'click',null,onunsaved);this._unsavedButton=button;}return this._unsavedButton;},_getUnsubmittedButton:function(){if(!this._unsubmittedButton){var
button=new
JX.PHUIXButtonView().setIcon('fa-comment-o').setButtonType(JX.PHUIXButtonView.BUTTONTYPE_SIMPLE);var
node=button.getNode();var
onunsubmitted=JX.bind(this,this._onunsubmittedclick);JX.DOM.listen(node,'click',null,onunsubmitted);this._unsubmittedButton=button;}return this._unsubmittedButton;},_getDoneButton:function(){if(!this._doneButton){var
button=new
JX.PHUIXButtonView().setIcon('fa-comment').setButtonType(JX.PHUIXButtonView.BUTTONTYPE_SIMPLE);var
node=button.getNode();var
ondone=JX.bind(this,this._ondoneclick);JX.DOM.listen(node,'click',null,ondone);this._doneButton=button;}return this._doneButton;},_getMenuButton:function(){if(!this._menuButton){var
pht=this.getTranslations();var
button=new
JX.PHUIXButtonView().setIcon('fa-bars').setButtonType(JX.PHUIXButtonView.BUTTONTYPE_SIMPLE).setAuralLabel(pht('Display Options'));var
dropdown=new
JX.PHUIXDropdownMenu(button.getNode());this._menuItems={};var
list=new
JX.PHUIXActionListView();dropdown.setContent(list.getNode());var
map={hideDone:{type:'done'},hideCollapsed:{type:'collapsed'},hideGhosts:{type:'ghosts'},hideAll:{type:'all'},showAll:{type:'show'}};for(var
k
in
map){var
spec=map[k];var
handler=JX.bind(this,this._onhideinlines,spec.type);var
item=new
JX.PHUIXActionView().setHandler(handler);list.addItem(item);this._menuItems[k]=item;}dropdown.listen('open',JX.bind(this,this._ondropdown));if(this.getInlineListURI()){list.addItem(new
JX.PHUIXActionView().setDivider(true));list.addItem(new
JX.PHUIXActionView().setIcon('fa-external-link').setName(pht('List Inline Comments')).setHref(this.getInlineListURI()));}this._menuButton=button;this._dropdownMenu=dropdown;}return this._menuButton;},_ondropdown:function(){var
inlines=this._getInlinesByType();var
items=this._menuItems;var
pht=this.getTranslations();items.hideDone.setName(pht('Hide "Done" Inlines')).setDisabled(!inlines.visibleDone.length);items.hideCollapsed.setName(pht('Hide Collapsed Inlines')).setDisabled(!inlines.visibleCollapsed.length);items.hideGhosts.setName(pht('Hide Older Inlines')).setDisabled(!inlines.visibleGhosts.length);items.hideAll.setName(pht('Hide All Inlines')).setDisabled(!inlines.visible.length);items.showAll.setName(pht('Show All Inlines')).setDisabled(!inlines.hidden.length);},_onhideinlines:function(type,e){this._dropdownMenu.close();e.prevent();this._toggleInlines(type);},_toggleInlines:function(type){var
inlines=this._getInlinesByType();this._setSelectionState(null);var
targets;var
mode=true;switch(type){case'done':targets=inlines.visibleDone;break;case'collapsed':targets=inlines.visibleCollapsed;break;case'ghosts':targets=inlines.visibleGhosts;break;case'all':targets=inlines.visible;break;case'show':targets=inlines.hidden;mode=false;break;}for(var
ii=0;ii<targets.length;ii++){targets[ii].setHidden(mode);}},_onunsavedclick:function(e){e.kill();var
options={filter:'comment',wrap:true,show:true,attribute:'unsaved'};this._onjumpkey(1,options);},_onunsubmittedclick:function(e){e.kill();var
options={filter:'comment',wrap:true,show:true,attribute:'anyDraft'};this._onjumpkey(1,options);},_ondoneclick:function(e){e.kill();var
options={filter:'comment',wrap:true,show:true,attribute:this._doneMode};this._onjumpkey(1,options);},_getBannerNode:function(){if(!this._bannerNode){var
attributes={className:'diff-banner',id:'diff-banner'};this._bannerNode=JX.$N('div',attributes);}return this._bannerNode;},_getVisibleChangeset:function(){if(this.isAsleep()){return null;}if(JX.Device.getDevice()!='desktop'){return null;}var
margin=480;var
s=JX.Vector.getScroll();if(s.y<margin){return null;}var
detect_height=64;for(var
ii=0;ii<this._changesets.length;ii++){var
changeset=this._changesets[ii];var
c=changeset.getVectors();if(c.pos.y<=(s.y+detect_height)){if((c.pos.y+c.dim.y)>=(s.y+detect_height)){return changeset;}}}return null;},_getTreeView:function(){if(!this._treeView){var
tree=new
JX.DiffTreeView();for(var
ii=0;ii<this._changesets.length;ii++){var
changeset=this._changesets[ii];tree.addPath(changeset.getPathView());}this._treeView=tree;}return this._treeView;},_redrawFiletree:function(){var
formation=this.getFormationView();if(!formation){return;}var
filetree=formation.getColumn(0);var
flank=filetree.getFlank();var
flank_body=flank.getBodyNode();var
tree=this._getTreeView();JX.DOM.setContent(flank_body,tree.getNode());},_setupInlineCommentListeners:function(){var
onsave=JX.bind(this,this._onInlineEvent,'save');JX.Stratcom.listen(['submit','didSyntheticSubmit'],'inline-edit-form',onsave);var
oncancel=JX.bind(this,this._onInlineEvent,'cancel');JX.Stratcom.listen('click','inline-edit-cancel',oncancel);var
onundo=JX.bind(this,this._onInlineEvent,'undo');JX.Stratcom.listen('click','differential-inline-comment-undo',onundo);var
ondone=JX.bind(this,this._onInlineEvent,'done');JX.Stratcom.listen('click',['differential-inline-comment','differential-inline-done'],ondone);var
ondelete=JX.bind(this,this._onInlineEvent,'delete');JX.Stratcom.listen('click',['differential-inline-comment','differential-inline-delete'],ondelete);var
onmenu=JX.bind(this,this._onInlineEvent,'menu');JX.Stratcom.listen('click',['differential-inline-comment','inline-action-dropdown'],onmenu);var
ondraft=JX.bind(this,this._onInlineEvent,'draft');JX.Stratcom.listen('keydown',['differential-inline-comment','tag:textarea'],ondraft);var
on_preview_view=JX.bind(this,this._onPreviewEvent,'view');JX.Stratcom.listen('click','differential-inline-preview-jump',on_preview_view);},_onPreviewEvent:function(action,e){if(this.isAsleep()){return;}var
data=e.getNodeData('differential-inline-preview-jump');var
inline=this.getInlineByID(data.inlineCommentID);if(!inline){return;}e.kill();switch(action){case'view':this.selectInline(inline,true,true);break;}},_onInlineEvent:function(action,e){if(this.isAsleep()){return;}if(action!=='draft'&&action!=='menu'){e.kill();}var
inline=this._getInlineForEvent(e);var
is_ref=false;if(inline===null){var
data=e.getNodeData('differential-inline-comment');inline=this.getInlineByID(data.id);if(inline){is_ref=true;}else{switch(action){case'delete':this._deleteInlineByID(data.id);return;}}}switch(action){case'save':inline.save();break;case'cancel':inline.cancel();break;case'undo':inline.undo();break;case'done':inline.toggleDone();break;case'delete':inline.delete(is_ref);break;case'draft':inline.triggerDraft();break;case'menu':var
node=e.getNode('inline-action-dropdown');inline.activateMenu(node,e);break;}},_onSelectRange:function(e){this._updateSourceSelection();},_updateSourceSelection:function(){var
ranges=this._getSelectedRanges();if(!ranges.length){this._setSourceSelection(null,null);return;}var
min=0;var
max=ranges.length-1;var
head=ranges[min].startContainer;var
last=ranges[max].endContainer;var
head_loc=this._getFragmentLocation(head);var
last_loc=this._getFragmentLocation(last);if(head_loc===null||last_loc===null){this._setSourceSelection(null,null);return;}if(head_loc.changesetID!==last_loc.changesetID){this._setSourceSelection(null,null);return;}head_loc.offset+=ranges[min].startOffset;last_loc.offset+=ranges[max].endOffset;this._setSourceSelection(head_loc,last_loc);},_setSourceSelection:function(start,end){var
start_updated=!this._isSameSourceSelection(this._sourceSelectionStart,start);var
end_updated=!this._isSameSourceSelection(this._sourceSelectionEnd,end);if(!start_updated&&!end_updated){return;}this._sourceSelectionStart=start;this._sourceSelectionEnd=end;if(!start){this._closeSourceSelectionMenu();return;}var
menu;if(this._sourceSelectionMenu){menu=this._sourceSelectionMenu;}else{menu=this._newSourceSelectionMenu();this._sourceSelectionMenu=menu;}var
pos=JX.$V(start.node).add(0,-menu.getMenuNodeDimensions().y).add(0,-24);menu.setPosition(pos);menu.open();},_newSourceSelectionMenu:function(){var
pht=this.getTranslations();var
menu=new
JX.PHUIXDropdownMenu(null).setWidth(240);menu.setDisableAutofocus(true);var
list=new
JX.PHUIXActionListView();menu.setContent(list.getNode());var
oncreate=JX.bind(this,this._onSourceSelectionMenuAction,'create');var
comment_item=new
JX.PHUIXActionView().setIcon('fa-comment-o').setName(pht('New Inline Comment')).setKeyCommand('c').setHandler(oncreate);list.addItem(comment_item);return menu;},_onSourceSelectionMenuAction:function(action,e){e.kill();this._closeSourceSelectionMenu();switch(action){case'create':this._onKeyCreate();break;}},_closeSourceSelectionMenu:function(){if(this._sourceSelectionMenu){this._sourceSelectionMenu.close();}},_isSameSourceSelection:function(u,v){if(u===null&&v===null){return true;}if(u===null&&v!==null){return false;}if(u!==null&&v===null){return false;}return((u.changesetID===v.changesetID)&&(u.line===v.line)&&(u.displayColumn===v.displayColumn)&&(u.offset===v.offset));},_getFragmentLocation:function(fragment){var
changeset=null;try{var
node=JX.DOM.findAbove(fragment,'div','differential-changeset');changeset=this.getChangesetForNode(node);if(!changeset){return null;}}catch(ex){return null;}var
line=null;var
column_count=-1;var
has_new=false;var
has_old=false;var
offset=null;var
target_node=null;var
td;try{var
is_end;if(JX.DOM.isType(fragment.parentNode,'tr')){var
cells=fragment.parentNode.previousSibling.childNodes;td=cells[cells.length-1];is_end=true;}else{td=this._findContentCell(fragment);is_end=false;}var
cursor=td;while(cursor){if(cursor.getAttribute('data-copy-mode')){column_count++;}else{if(cursor.id.match(/NL/)){has_new=true;}else
if(cursor.id.match(/OL/)){has_old=true;}}var
n=parseInt(cursor.getAttribute('data-n'));if(n){if(line===null){target_node=cursor;line=n;}}cursor=cursor.previousSibling;}if(!line){return null;}if(column_count<0){if(has_new||has_old){if(has_new){column_count=1;}else{column_count=0;}}else{return null;}}var
info=this._getSelectionOffset(td,fragment);if(info.found){offset=info.offset;}else{if(is_end){offset=info.offset;}else{offset=0;}}}catch(ex){return null;}var
changeset_id;if(column_count>0){changeset_id=changeset.getRightChangesetID();}else{changeset_id=changeset.getLeftChangesetID();}return{node:td,changeset:changeset,changesetID:changeset_id,line:line,displayColumn:column_count,offset:offset,targetNode:target_node};},_getSelectionOffset:function(node,target){if(node.getAttribute&&node.getAttribute('data-aural')){return{offset:0,content:'',found:false};}if(!node.childNodes||!node.childNodes.length){return{offset:node.textContent.length,content:node.textContent,found:false};}var
found=false;var
offset=0;var
content='';for(var
ii=0;ii<node.childNodes.length;ii++){var
child=node.childNodes[ii];if(child===target){found=true;}var
spec=this._getSelectionOffset(child,target);content+=spec.content;if(!found){offset+=spec.offset;}found=found||spec.found;}return{offset:offset,content:content,found:found};},_getSelectedRanges:function(){var
ranges=[];if(!window.getSelection){return ranges;}var
selection=window.getSelection();for(var
ii=0;ii<selection.rangeCount;ii++){var
range=selection.getRangeAt(ii);if(range.collapsed){continue;}ranges.push(range);}return ranges;},_isContentCell:function(node){return!!node.getAttribute('data-copy-mode');},_findContentCell:function(node){var
cursor=node;while(true){cursor=JX.DOM.findAbove(cursor,'td');if(this._isContentCell(cursor)){return cursor;}}}}});JX.install('DiffTreeView',{construct:function(){this._keys=[];this._tree=this._newTreeNode(null,[],0);this._nodes={};this._paths=[];},members:{_node:null,_keys:null,_tree:null,_nodes:null,_dirty:false,_paths:null,_selectedPath:null,_focusedPath:null,getNode:function(){if(!this._node){var
attrs={className:'diff-tree-view'};this._node=JX.$N('ul',attrs);}if(this._dirty){this.redraw();}return this._node;},addPath:function(path){this._paths.push(path);var
tree=this._getTree(this._tree,path.getPath(),0);tree.pathObject=path;this._dirty=true;return this;},getPaths:function(){return this._paths;},setSelectedPath:function(path){if(this._selectedPath){this._selectedPath.setIsSelected(false);this._selectedPath=null;}if(path){path.setIsSelected(true);}this._selectedPath=path;return this;},setFocusedPath:function(path){if(this._focusedPath){this._focusedPath.setIsFocused(false);this._focusedPath=null;}if(path){path.setIsFocused(true);}this._focusedPath=path;return this;},redraw:function(){if(!this._dirty){return;}this._dirty=false;var
ii;var
tree;var
path;var
trees=[];for(ii=0;ii<this._keys.length;ii++){var
key=this._keys[ii];tree=this._nodes[key];path=tree.pathObject;if(!path){path=new
JX.DiffPathView().setPath(tree.parts);path.getIcon().setIcon('fa-folder-open-o').setColor('grey');tree.pathObject=path;}trees.push(tree);}for(ii=0;ii<trees.length;ii++){tree=trees[ii];tree.displayRoot=null;tree.displayPath=null;tree.displayHide=false;}var
child;for(ii=0;ii<trees.length;ii++){tree=trees[ii];if(tree.childCount!==1){continue;}for(var
k
in
tree.children){if(tree.children.hasOwnProperty(k)){child=tree.children[k];break;}}if(child.pathObject.getChangeset()){continue;}child.displayRoot=tree.displayRoot||tree;}for(ii=0;ii<trees.length;ii++){tree=trees[ii];if(!tree.displayRoot){continue;}if(!tree.displayRoot.displayPath){tree.displayRoot.displayPath=[tree.displayRoot.parts[tree.displayRoot.parts.length-1]];}tree.displayRoot.displayPath.push(tree.parts[tree.parts.length-1]);tree.displayHide=true;}for(ii=0;ii<trees.length;ii++){tree=trees[ii];path=tree.pathObject;path.setHidden(!!tree.displayHide);if(tree.displayPath){path.setDisplayPath(tree.displayPath.join('/'));}else{path.setDisplayPath(null);}}for(ii=0;ii<trees.length;ii++){tree=trees[ii];if(!tree.parent){tree.depth=0;}else{if(tree.displayHide){tree.depth=tree.parent.depth;}else{tree.depth=tree.parent.depth+1;}}path=tree.pathObject;if(tree.childCount>0){path.setIsDirectory(true);}path.setDepth((tree.depth-1));}var
nodes=[];for(ii=0;ii<trees.length;ii++){tree=trees[ii];nodes.push(tree.pathObject.getNode());}JX.DOM.setContent(this.getNode(),nodes);},_getTree:function(root,path,ii){if(ii>=path.length){return root;}var
part=path[ii];if(!root.children.hasOwnProperty(part)){root.children[part]=this._newTreeNode(root,path,ii);root.childCount++;}return this._getTree(root.children[part],path,ii+1);},_newTreeNode:function(parent,path,ii){var
key;var
parts;if(path.length){parts=path.slice(0,ii+1);key=parts.join('/');this._keys.push(key);}else{parts=[];key=null;}var
node={parent:parent,nodeKey:key,parts:parts,children:{},pathObject:null,childCount:0,depth:0};if(key!==null){this._nodes[key]=node;}return node;}}});JX.install('DiffPathView',{construct:function(){},members:{_node:null,_path:null,_depth:0,_selected:false,_focused:false,_icon:null,_indentNode:null,_pathNode:null,_changeset:null,_inlineNode:null,_isDirectory:false,_displayPath:null,_isLowImportance:false,_isOwned:false,_isHidden:false,_isLoading:false,getNode:function(){if(!this._node){var
attrs={className:'diff-tree-path'};this._node=JX.$N('li',attrs,this._getIndentNode());var
onclick=JX.bind(this,this._onclick);JX.DOM.listen(this._node,'click',null,onclick);}return this._node;},getIcon:function(){if(!this._icon){this._icon=new
JX.PHUIXIconView();}return this._icon;},setPath:function(path){this._path=path;this._redrawPath();return this;},setDisplayPath:function(path){this._displayPath=path;this._redrawPath();return this;},setIsDirectory:function(is_directory){this._isDirectory=is_directory;this._redrawPath();return this;},setChangeset:function(changeset){this._changeset=changeset;var
node=this.getNode();JX.DOM.alterClass(node,'diff-tree-path-changeset',!!changeset);return this;},getChangeset:function(){return this._changeset;},getPath:function(){return this._path;},setHidden:function(hidden){this._hidden=hidden;var
node=this.getNode();if(this._hidden){JX.DOM.hide(node);}else{JX.DOM.show(node);}return this;},setDepth:function(depth){this._depth=depth;this._getIndentNode().style.marginLeft=(8*this._depth)+'px';return this;},setIsSelected:function(selected){this._selected=selected;var
node=this.getNode();JX.DOM.alterClass(node,'diff-tree-path-selected',this._selected);return this;},setIsFocused:function(focused){this._focused=focused;var
node=this.getNode();JX.DOM.alterClass(node,'diff-tree-path-focused',this._focused);return this;},setIsLowImportance:function(low_importance){this._isLowImportance=low_importance;var
node=this.getNode();JX.DOM.alterClass(node,'diff-tree-path-low-importance',this._isLowImportance);return this;},setIsOwned:function(owned){this._isOwned=owned;var
node=this.getNode();JX.DOM.alterClass(node,'diff-tree-path-owned',this._isOwned);return this;},setIsHidden:function(hidden){this._isHidden=hidden;var
node=this.getNode();JX.DOM.alterClass(node,'diff-tree-path-hidden',this._isHidden);return this;},setIsLoading:function(loading){this._isLoading=loading;var
node=this.getNode();JX.DOM.alterClass(node,'diff-tree-path-loading',this._isLoading);return this;},_onclick:function(e){if(!e.isNormalClick()){return;}var
changeset=this.getChangeset();if(changeset){changeset.select(true);}e.kill();},_getIndentNode:function(){if(!this._indentNode){var
attrs={className:'diff-tree-path-indent'};var
content=[this.getInlineNode(),this._getHiddenIconNode(),this._getIconNode(),this._getPathNode(),];this._indentNode=JX.$N('div',attrs,content);}return this._indentNode;},_getPathNode:function(){if(!this._pathNode){var
attrs={className:'diff-tree-path-name'};this._pathNode=JX.$N('div',attrs);}return this._pathNode;},_getIconNode:function(){if(!this._iconNode){var
attrs={className:'diff-tree-path-icon diff-tree-path-icon-kind',};this._iconNode=JX.$N('div',attrs,this.getIcon().getNode());}return this._iconNode;},_getHiddenIconNode:function(){if(!this._hiddenIconNode){var
attrs={className:'diff-tree-path-icon diff-tree-path-icon-hidden',};this._hiddenIconNode=JX.$N('div',attrs,this._getHiddenIcon().getNode());}return this._hiddenIconNode;},_getHiddenIcon:function(){if(!this._hiddenIcon){this._hiddenIcon=new
JX.PHUIXIconView().setIcon('fa-times-circle-o');}return this._hiddenIcon;},getInlineNode:function(){if(!this._inlineNode){var
attrs={className:'diff-tree-path-inlines',};this._inlineNode=JX.$N('div',attrs,'-');}return this._inlineNode;},_redrawPath:function(){var
display;if(this._displayPath){display=this._displayPath;}else{display=this._path[this._path.length-1];}var
is_directory=this._isDirectory;if(is_directory){display=display+'/';}JX.DOM.setContent(this._getPathNode(),display);}}});JX.install('PHUIXFormationView',{construct:function(node){this._node=node;this._columns=[];var
config=JX.Stratcom.getData(this._node);var
items=config.items;var
count=items.length;for(var
ii=0;ii<count;ii++){var
item=items[ii];var
item_node=JX.$(item.itemID);var
column=new
JX.PHUIXFormationColumnView(item_node).setIsRightAligned(item.isRightAligned).setWidth(item.width).setIsVisible(item.isVisible);if(item.expanderID){column.setExpanderNode(JX.$(item.expanderID));}if(item.resizer){column.setWidthSettingKey(item.resizer.widthKey).setVisibleSettingKey(item.resizer.visibleKey).setMinimumWidth(item.resizer.minimumWidth).setMaximumWidth(item.resizer.maximumWidth).setResizerItem(JX.$(item.resizer.itemID)).setResizerControl(JX.$(item.resizer.controlID));}var
spec=item.column;if(spec){if(spec.type==='flank'){var
flank_node=JX.$(spec.nodeID);var
head=JX.$(spec.headID);var
body=JX.$(spec.bodyID);var
tail=JX.$(spec.tailID);var
flank=new
JX.PHUIXFormationFlankView(flank_node,head,body,tail);flank.setIsFixed(spec.isFixed);column.setFlank(flank);}}this.addColumn(column);}},members:{_node:null,_columns:null,addColumn:function(column){this._columns.push(column);},getColumn:function(idx){return this._columns[idx];},start:function(){JX.enableDispatch(document.body,'mousemove');for(var
ii=0;ii<this._columns.length;ii++){this._columns[ii].start();}var
repaint=JX.bind(this,this.repaint);JX.Stratcom.listen(['scroll','resize'],null,repaint);this.repaint();},repaint:function(e){var
menu_height=(44-JX.Vector.getScroll().y);var
banner_height=0;try{var
banner=JX.$('diff-banner');banner_height=JX.Vector.getDim(banner).y;}catch(error){}var
header_height=Math.max(0,menu_height,banner_height);var
column;var
flank;for(var
ii=0;ii<this._columns.length;ii++){column=this._columns[ii];flank=column.getFlank();if(!flank){continue;}flank.setBannerHeight(header_height).setWidth(column.getWidth()).repaint();}}}});JX.install('PHUIXFormationColumnView',{construct:function(node){this._node=node;},properties:{isRightAligned:false,isVisible:true,expanderNode:null,resizerItem:null,resizerControl:null,width:null,widthSettingKey:null,visibleSettingKey:null,minimumWidth:null,maximumWidth:null,flank:null},members:{_node:null,_resizingWidth:null,_resizingBarPosition:null,_dragging:null,start:function(){var
onshow=JX.bind(this,this._setVisibility,true);var
onhide=JX.bind(this,this._setVisibility,false);JX.DOM.listen(this._node,'click','phui-flank-header-hide',onhide);var
expander=this.getExpanderNode();if(expander){JX.DOM.listen(expander,'click',null,onshow);}var
resizer=this.getResizerItem();if(resizer){var
ondown=JX.bind(this,this._onresizestart);JX.DOM.listen(resizer,'mousedown',null,ondown);var
onmove=JX.bind(this,this._onresizemove);JX.Stratcom.listen('mousemove',null,onmove);var
onup=JX.bind(this,this._onresizeend);JX.Stratcom.listen('mouseup',null,onup);}this.repaint();},_onresizestart:function(e){if(!e.isNormalMouseEvent()){return;}this._dragging=JX.$V(e);this._resizingWidth=this.getWidth();this._resizingBarPosition=JX.$V(this.getResizerControl());JX.DOM.alterClass(document.body,'jx-drag-col',true);e.kill();},_onresizemove:function(e){if(!this._dragging){return;}var
dx=(JX.$V(e).x-this._dragging.x);var
width;if(this.getIsRightAligned()){width=this.getWidth()-dx;}else{width=this.getWidth()+dx;}var
min_width=this.getMinimumWidth();if(min_width){width=Math.max(width,min_width);}var
max_width=this.getMaximumWidth();if(max_width){width=Math.min(width,max_width);}this._resizingWidth=width;this._node.style.width=this._resizingWidth+'px';var
adjust_x=(this._resizingWidth-this.getWidth());if(this.getIsRightAligned()){adjust_x=-adjust_x;}this.getResizerControl().style.left=(this._resizingBarPosition.x+adjust_x)+'px';var
flank=this.getFlank();if(flank){flank.setWidth(this._resizingWidth).repaint();}},_onresizeend:function(e){if(!this._dragging){return;}this.setWidth(this._resizingWidth);JX.DOM.alterClass(document.body,'jx-drag-col',false);this._dragging=null;var
width_key=this.getWidthSettingKey();if(width_key){this._adjustSetting(width_key,this.getWidth());}},_setVisibility:function(visible,e){e.kill();this.setVisibility(visible);},toggleVisibility:function(){return this.setVisibility(!this.getIsVisible());},setVisibility:function(visible){this.setIsVisible(visible);this.repaint();var
visible_key=this.getVisibleSettingKey();if(visible_key){this._adjustSetting(visible_key,visible?1:0);}return this;},_adjustSetting:function(key,value){new
JX.Request('/settings/adjust/',JX.bag).setData({key:key,value:value}).send();},repaint:function(){var
resizer=this.getResizerItem();var
expander=this.getExpanderNode();if(this.getIsVisible()){JX.DOM.show(this._node);if(resizer){JX.DOM.show(resizer);}if(expander){JX.DOM.hide(expander);}}else{JX.DOM.hide(this._node);if(resizer){JX.DOM.hide(resizer);}if(expander){JX.DOM.show(expander);}}if(this.getFlank()){this.getFlank().repaint();}},}});JX.install('PHUIXFormationFlankView',{construct:function(node,head,body,tail){this._node=node;this._headNode=head;this._bodyNode=body;this._tailNode=tail;},properties:{isFixed:false,bannerHeight:null,width:null},members:{_node:null,_headNode:null,_bodyNode:null,_tailNode:null,getBodyNode:function(){return this._bodyNode;},getTailNode:function(){return this._tailNode;},repaint:function(){if(!this.getIsFixed()){return;}this._node.style.top=this.getBannerHeight()+'px';this._node.style.width=this.getWidth()+'px';var
body=this.getBodyNode();var
body_pos=JX.$V(body);var
tail=this.getTailNode();var
tail_pos=JX.$V(tail);var
max_height=(tail_pos.y-body_pos.y);body.style.maxHeight=max_height+'px';}}});JX.install('ExternalEditorLinkEngine',{properties:{template:null,variables:null},members:{newURI:function(){var
template=this.getTemplate();var
variables=this.getVariables();var
parts=[];for(var
ii=0;ii<template.length;ii++){var
part=template[ii];var
value=part.value;if(part.type==='literal'){parts.push(value);continue;}if(part.type==='variable'){if(variables.hasOwnProperty(value)){var
replacement=variables[value];replacement=encodeURIComponent(replacement);parts.push(replacement);}}}return parts.join('');}}});