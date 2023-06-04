JX.install('WorkboardColumn',{construct:function(board,phid,root){this._board=board;this._phid=phid;this._root=root;this._panel=JX.DOM.findAbove(root,'div','workpanel');this._pointsNode=JX.DOM.find(this._panel,'span','column-points');this._pointsContentNode=JX.DOM.find(this._panel,'span','column-points-content');this._cards={};this._headers={};this._objects=[];this._naturalOrder=[];this._dropEffects=[];},properties:{triggerPreviewEffect:null},members:{_phid:null,_root:null,_board:null,_cards:null,_headers:null,_naturalOrder:null,_orderVectors:null,_panel:null,_pointsNode:null,_pointsContentNode:null,_dirty:true,_objects:null,_dropEffects:null,getPHID:function(){return this._phid;},getRoot:function(){return this._root;},getCards:function(){return this._cards;},_getObjects:function(){return this._objects;},getCard:function(phid){return this._cards[phid];},getBoard:function(){return this._board;},setNaturalOrder:function(order){this._naturalOrder=order;this._orderVectors=null;return this;},setDropEffects:function(effects){this._dropEffects=effects;return this;},getDropEffects:function(){return this._dropEffects;},getPointsNode:function(){return this._pointsNode;},getPointsContentNode:function(){return this._pointsContentNode;},getWorkpanelNode:function(){return this._panel;},newCard:function(phid){var
card=new
JX.WorkboardCard(this,phid);this._cards[phid]=card;this._naturalOrder.push(phid);this._orderVectors=null;return card;},removeCard:function(phid){var
card=this._cards[phid];delete
this._cards[phid];for(var
ii=0;ii<this._naturalOrder.length;ii++){if(this._naturalOrder[ii]==phid){this._naturalOrder.splice(ii,1);this._orderVectors=null;break;}}return card;},addCard:function(card,after){var
phid=card.getPHID();card.setColumn(this);this._cards[phid]=card;var
index=0;if(after){for(var
ii=0;ii<this._naturalOrder.length;ii++){if(this._naturalOrder[ii]==after){index=ii+1;break;}}}if(index>this._naturalOrder.length){this._naturalOrder.push(phid);}else{this._naturalOrder.splice(index,0,phid);}this._orderVectors=null;return this;},getDropTargetNodes:function(){var
objects=this._getObjects();var
nodes=[];for(var
ii=0;ii<objects.length;ii++){var
object=objects[ii];nodes.push(object.getNode());}return nodes;},getCardPHIDs:function(){return JX.keys(this.getCards());},getPointLimit:function(){return JX.Stratcom.getData(this.getRoot()).pointLimit;},markForRedraw:function(){this._dirty=true;},isMarkedForRedraw:function(){return this._dirty;},getHeader:function(key){if(!this._headers[key]){this._headers[key]=new
JX.WorkboardHeader(this,key);}return this._headers[key];},handleDragGhost:function(default_handler,ghost,node){if(this._hasColumnHeaders()){if(!node){return false;}}return default_handler(ghost,node);},_hasColumnHeaders:function(){var
board=this.getBoard();var
order=board.getOrder();return board.getOrderTemplate(order).getHasHeaders();},redraw:function(){var
board=this.getBoard();var
order=board.getOrder();var
list=this._getCardsSortedByKey(order);var
ii;var
objects=[];var
has_headers=this._hasColumnHeaders();var
header_keys=[];var
seen_headers={};if(has_headers){var
header_templates=board.getHeaderTemplatesForOrder(order);for(var
k
in
header_templates){header_keys.push(header_templates[k].getHeaderKey());}header_keys.reverse();}var
header_key;var
next;for(ii=0;ii<list.length;ii++){var
card=list[ii];if(has_headers){header_key=board.getCardTemplate(card.getPHID()).getHeaderKey(order);if(!seen_headers[header_key]){while(header_keys.length){next=header_keys.pop();var
header=this.getHeader(next);objects.push(header);seen_headers[header_key]=true;if(next===header_key){break;}}}}objects.push(card);}while(header_keys.length){next=header_keys.pop();if(seen_headers[next]){continue;}objects.push(this.getHeader(next));}this._objects=objects;var
content=[];for(ii=0;ii<this._objects.length;ii++){var
object=this._objects[ii];var
node=object.getNode();content.push(node);}JX.DOM.setContent(this.getRoot(),content);this._redrawFrame();this._dirty=false;},compareHandler:function(src_list,src_node,dst_list,dst_node){var
board=this.getBoard();var
order=board.getOrder();var
u_vec=this._getNodeOrderVector(src_node,order);var
v_vec=this._getNodeOrderVector(dst_node,order);return board.compareVectors(u_vec,v_vec);},_getNodeOrderVector:function(node,order){var
board=this.getBoard();var
data=JX.Stratcom.getData(node);if(data.objectPHID){return this._getOrderVector(data.objectPHID,order);}return board.getHeaderTemplate(data.headerKey).getVector();},setIsDropTarget:function(is_target){var
node=this.getWorkpanelNode();JX.DOM.alterClass(node,'workboard-column-drop-target',is_target);},_getCardsSortedByKey:function(order){var
cards=this.getCards();var
list=[];for(var
k
in
cards){list.push(cards[k]);}list.sort(JX.bind(this,this._sortCards,order));return list;},_sortCards:function(order,u,v){var
board=this.getBoard();var
u_vec=this._getOrderVector(u.getPHID(),order);var
v_vec=this._getOrderVector(v.getPHID(),order);return board.compareVectors(u_vec,v_vec);},_getOrderVector:function(phid,order){var
board=this.getBoard();if(!this._orderVectors){this._orderVectors={};}if(!this._orderVectors[order]){var
cards=this.getCards();var
vectors={};for(var
k
in
cards){var
card_phid=cards[k].getPHID();var
vector=board.getCardTemplate(card_phid).getSortVector(order);vectors[card_phid]=[].concat(vector);vectors[card_phid].push(1);}for(var
ii=0;ii<this._naturalOrder.length;ii++){var
natural_phid=this._naturalOrder[ii];if(vectors[natural_phid]){vectors[natural_phid].push(ii);}}this._orderVectors[order]=vectors;}if(!this._orderVectors[order][phid]){var
incoming_vector=board.getCardTemplate(phid).getSortVector(order);incoming_vector=[].concat(incoming_vector);incoming_vector.push(1);incoming_vector.push(0);return incoming_vector;}return this._orderVectors[order][phid];},_redrawFrame:function(){var
cards=this.getCards();var
board=this.getBoard();var
points={};var
count=0;var
decimal_places=0;for(var
phid
in
cards){var
card=cards[phid];var
card_points;if(board.getPointsEnabled()){card_points=card.getPoints();}else{card_points=1;}if(card_points!==null){var
status=card.getStatus();if(!points[status]){points[status]=0;}points[status]+=card_points;var
parts=card_points.toString().split('.');if(parts[1]){decimal_places=Math.max(decimal_places,parts[1].length);}}count++;}var
total_points=0;for(var
k
in
points){total_points+=points[k];}total_points=total_points.toFixed(decimal_places);var
limit=this.getPointLimit();var
display_value;if(limit!==null&&limit!==0){display_value=total_points+' / '+limit;}else{display_value=total_points;}if(board.getPointsEnabled()){display_value=count+' | '+display_value;}var
over_limit=((limit!==null)&&(total_points>limit));var
content_node=this.getPointsContentNode();var
points_node=this.getPointsNode();JX.DOM.setContent(content_node,display_value);var
is_empty=(!this.getCardPHIDs().length)&&(!this._hasColumnHeaders());var
panel=JX.DOM.findAbove(this.getRoot(),'div','workpanel');JX.DOM.alterClass(panel,'project-panel-empty',is_empty);JX.DOM.alterClass(panel,'project-panel-over-limit',over_limit);var
color_map={'phui-tag-disabled':(total_points===0),'phui-tag-blue':(total_points>0&&!over_limit),'phui-tag-red':(over_limit)};for(var
c
in
color_map){JX.DOM.alterClass(points_node,c,!!color_map[c]);}JX.DOM.show(points_node);}}});