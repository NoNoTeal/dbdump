JX.behavior('linked-container',function(){JX.Stratcom.listen('click','linked-container',function(e){if(e.getNode('tag:a')){return;}if(!e.isLeftButton()){return;}var
container=e.getNode('linked-container');var
link=JX.DOM.scry(container,'a')[0];if(!link){return;}var
is_command=!!e.getRawEvent().metaKey;if(is_command){var
old_target=link.target;link.target='_blank';link.click();link.target=old_target;}else{link.click();}});});