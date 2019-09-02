var ERDDAP = function(settings){
    this.settings = settings;
	this.endpoint = settings.url.replace(/\/+$/, "");
	this.disabledkey =  this.endpoint+".disabled";
	this.settings.disabled = localStorage.getItem(this.disabledkey)?true:false;
}

ERDDAP.prototype.setDisabled = function(disabled){
		this.settings.disabled = disabled;
		if(disabled){
			localStorage.setItem(this.disabledkey,"true");
		}else{
			localStorage.removeItem(this.disabledkey);
		}
}

var e2o = function(data){
	var keys = data.table.columnNames;
	var results = [];
	data.table.rows.forEach(function(row){
		var result = [];
		for(var i=0;i<keys.length;i++){
			result[keys[i]] = row[i];
		}
		results.push(result);
	});
	//console.log(results);
	return {data:results};
};
var nc_global2o = function(results){
	var info = {};
	results.data.forEach(function(x){
		if(x["Variable Name"] == "NC_GLOBAL"){
			info[x["Attribute Name"]] = x.Value;
		}
	})

	return info;
}
getDatasetInfo = function(url){
	return fetchJsonp(url,{jsonpCallback: ".jsonp"})
		.then(function(response){
			return response.json();
		}).then(e2o).then(nc_global2o).catch(function(x){
			console.log("no results from "+url);
		});
}

ERDDAP.prototype.search = function(query,page,itemsPerPage,timeout){
	page = page || 1;
	itemsPerPage = itemsPerPage  || 10000;
	timeout = timeout || this.settings.timeout || 30000;
	var url = this.endpoint + "/search/index.json?";
	var urlParams = new URLSearchParams("?");
	urlParams.set("searchFor",query);
	urlParams.set("page",page);
	urlParams.set("itemsPerPage",itemsPerPage);
	return fetchJsonp(url + urlParams.toString(),{ timeout: timeout, headers: {'Cache-Control': 'no-cache', 'Pragma': 'no-cache'}, jsonpCallback: ".jsonp"})
		.then(function(response) {
			var answer = response.json();
			this.settings.connected = true;
    		return answer;
  		}.bind(this))
  		.then(e2o);
}
ERDDAP.prototype.testConnect = function(){
	this.settings.connected = false;
	return new Promise(function(resolve,reject){
		this.search("time",1,1,5000).then(function(){resolve(true);})
			.catch(function(e){
				console.log("(testConnect)",e);
				resolve(false);
			});
	}.bind(this));
}
ERDDAP.prototype.settingstr = function(container,index){
	var tr = document.createElement("tr");
//	var indextd = document.createElement("td");
//	indextd.appendChild(document.createTextNode((index+1)+(".")))
//	tr.appendChild(indextd);
	var connecttd = document.createElement("td");
	var cb = document.createElement("input");
	cb.setAttribute("type","checkbox");
	var setTitle = function(cb){
		var connection_status = this.settings.connected?"Connection OK": "Connection test failed";
		var disabled_status = this.settings.disabled?", search disabled by user.":  this.settings.connected? ", search enabled.": ".";
		cb.setAttribute("title",connection_status+disabled_status);
	}.bind(this);
	var connected = this.settings.connected;
	if(connected){
		if(!this.settings.disabled){
			cb.setAttribute("checked",true);
		}
	}else{
		cb.setAttribute("disabled",true);
	}
	setTitle(cb);
	var erddap = this;
	cb.onclick = function(){
		erddap.setDisabled(!this.checked);
		setTitle(this);
	};
	var cblabel = document.createElement("label");
	cblabel.appendChild(cb);
	cblabel.appendChild(document.createTextNode(" "+(index+1)+(".")));
	var cbdiv = document.createElement("div");
	cbdiv.setAttribute("class","checkbox");
	cbdiv.appendChild(cblabel);
	var cbform = document.createElement("div");
	cbform.setAttribute("class","form-inline");
	cbform.appendChild(cbdiv);
	connecttd.appendChild(cbform);
	tr.appendChild(connecttd);
	var edit = document.createElement("td");
	if(erddap.settings.custom){
		var a = document.createElement("a");
		a.setAttribute("href","#delete")
		a.setAttribute("title","Delete this server from the list");
		a.setAttribute("class","btn btn-default");
		var trash = document.createElement("i");
		trash.setAttribute("class","fa fa-trash");
		a.onclick=function(){
			erddap.deleted = true;
			container.showServersList();
			return false;
		}
		a.appendChild(trash);
		a.appendChild(document.createTextNode("Delete"));
		edit.appendChild(a);
	}
	tr.appendChild(edit);
	var name = this.settings.name;
	var nametd = document.createElement("td");
	nametd.appendChild(document.createTextNode(name));
	tr.appendChild(nametd);
	var url = this.settings.url;
	var urltd = document.createElement("td");
	urltd.appendChild(document.createTextNode(url));
	tr.appendChild(urltd);
	return tr;
}

var addLinks = function(text){
	// see https://stackoverflow.com/questions/37684/how-to-replace-plain-urls-with-links
    // http://, https://, ftp://
    var urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#\/%?=~_|!:,.;]*[a-z0-9-+&@#\/%=~_|]/gim;

    // www. sans http:// or https://
    var pseudoUrlPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;

    // Email addresses
    var emailAddressPattern = /[\w.-]+@[a-zA-Z_-]+?(?:\.[a-zA-Z]{2,20})+/gim;

    return (""+text)
        .replace(urlPattern, '<a title="opens in a new window" target="_blank" href="$&">$&</a>')
        .replace(pseudoUrlPattern, '$1<a title="opens in a new window" target="_blank" href="http://$2">$2</a>')
        .replace(emailAddressPattern, '<a target="_blank" href="mailto:$&">$&</a>');
}
var showSearchResults = function(table,tbody,data){
	var td = function(text){
		var el = document.createElement("td");
		el.appendChild(document.createTextNode(text));
		return el;
	}
	var tr = function(o){
		var el = document.createElement("tr");
		var expand = td("");
		el.appendChild(expand);
		el.appendChild(td(o.Title));
		el.appendChild(td(o.Institution || ""));
		if(o.Info){
			var e = document.createElement("td");
			var link = document.createElement("a");
		    link.href = o.Info.replace(".json",".html");
		    link.title="opens in a new window";
		    link.target="_blank"
		    var infoLabel = link.href.replace("/index.html","");
		    var dsname = infoLabel.substring(infoLabel.lastIndexOf("/")+1);

		    link.appendChild(document.createTextNode(dsname));
			e.appendChild(link);
			e.appendChild(document.createElement("br"));
			e.appendChild(document.createTextNode(link.hostname));
			el.appendChild(e);
			expand.innerText = "+";
			expand.classList.add("btn");
			expand.classList.add("btn-primary");
			expand.addEventListener("click",function(){
				var idx = this.parentNode.rowIndex + 1;
				if(this.innerText == "-"){
					table.deleteRow(idx);
					this.innerText = "+";
					return;
				}

				var row = table.insertRow(idx);
				this.innerText = "-";
				var el = td("...");
				el.setAttribute("colspan",4);
				row.appendChild(el);
				getDatasetInfo(o.Info).then(function(metadata){
					var innerTable = document.createElement("table");
					innerTable.setAttribute("class","table");
					var email = {
						"@": '<i class="fa fa-envelope"></i> '
					};
					var url = {
						"ftp": '<i class="fa fa-external-link-alt"></i> ',
						"http": '<i class="fa fa-external-link-alt"></i> '
					}
					var datatype = {
								"grid": '<i class="fas fa-th"></i> ',
								"table": '<i class="fas fa-table"></i> ',
								"timeseries": '<i class="far fa-calendar"></i> ',
								"trajectory": '<i class="fa fa-location-arrow"></i> ',
								"point": '<i class="fas fa-map-marked-alt"></i> '
							};
					var personinst = {
								"person": '<i class="fas fa-user"></i> ',
								"institution": '<i class="fas fa-university"></i> ',
							};
					var extras = {
							cdm_data_type: datatype,
							creator_email: email,
							creator_type: personinst,
							creator_url: url,
							featureType: datatype,
							infoUrl: url,
							institution: { //TODO: move to config file
								"Marine Institute": "<img height='16' src='mi_logo_bw.png' alt='Marine Institute' /> ",
							},
							license: { //TODO: move to config file
								"Creative Commons Attribution 4.0": "<img height='16' src='cc-by-attribution.png' alt='CC BY' /> "
							},
							projection_type: {
								"map": '<i class="fas fa-map"></i> '
							},
							publisher_email: email,
							publisher_type: personinst,
							publisher_url: url,
							source: {
								"satellite": '<i class="fas fa-satellite"></i> ',

							},
							sourceUrl: {
								"local files": '<i class="fa fa-copy"></i> ',
								"local file": '<i class="fa fa-copy"></i> ',
								"database": '<i class="fa fa-database"></i> ',
								"cassandra": '<i class="fa fa-database"></i> ',
								"ftp": '<i class="fa fa-external-link-alt"></i> ',
								"http": '<i class="fa fa-external-link-alt"></i> '
							},
					}
					var default_extras = {
						license: '<i class="fa fa-balance-scale"></i> ',
						institution: '<i class="fas fa-university"></i> ',
						satellite: '<i class="fas fa-satellite"></i> ',
						projection: '<i class="fas fa-atlas"></i> '
					}

					var seen = [];
					var mtds = {};
					var addItem = function(irow,key,colspan){
						seen.push(key);
						var h = document.createElement('th');
						h.setAttribute("style","text-align: right");
						h.innerText = key;
						var d = document.createElement('td');
						if(colspan){
							d.setAttribute("colspan",colspan);
						}
						var html = addLinks(metadata[key]);
						var foundExtra = false;
						if(extras[key]){
							var htmlLowerCase = html.toLowerCase();
							Object.keys(extras[key]).forEach(function(string){
								if(!foundExtra){
									if(htmlLowerCase.indexOf(string.toLowerCase())>=0){
										html = extras[key][string]+html;
										foundExtra = true;
									}
								}
							})
						}
						if(default_extras[key] && !foundExtra){
							html = default_extras[key]+html;
						}
						d.innerHTML = html;
						irow.appendChild(h);
						irow.appendChild(d);
						mtds[key] = d;
					}
					var addRow = function(key,colspan){
						if(metadata[key] === undefined || seen.indexOf(key) >=0){
							return;
						}
						var irow = innerTable.insertRow(-1);
						addItem(irow,key,colspan);
						return irow;
					};
					var addPair	= function(a,b){
						var irow = addRow(a);
						if(irow){
							addItem(irow,b);
						}
					};

					["title","institution","cdm_data_type","summary","license"].forEach(function(key){
						addRow(key,3);
					});
					addPair("time_coverage_start","time_coverage_end");
					var spatial = ["geospatial_lat_min","geospatial_lat_max","geospatial_lon_min","geospatial_lon_max"];
					var mapDiv = false;
					var bounds = [];
					var point = false;
					if(spatial.filter(function(s){return metadata[s] !== undefined;}).length == spatial.length){
						bounds = [[metadata["geospatial_lat_min"],metadata["geospatial_lon_min"]],
									  [metadata["geospatial_lat_max"],metadata["geospatial_lon_max"]]];
						try{
							var parsedRoundedBounds = bounds.map(function(x){return Math.round(parseFloat(x)*1000);});
							if(parsedRoundedBounds[0] == parsedRoundedBounds[1] && parsedRoundedBounds[2] == parsedRoundedBounds[3]){
								point = bounds[0];
							}
						}catch(oh_well){};

						// let's add a map.
						Object.keys(metadata).forEach(function(key){
							if(key.startsWith("geospatial_") && spatial.indexOf(key)<0)
							spatial.push(key);
						});
						spatial.sort(function(a, b) {
							var sub = function(s){return s.replace("_min","_maa");};
							var x = sub(a);
							var y = sub(b);
						  if (x < y) {
						    return -1;
						  }
						  if (x > y) {
						    return 1;
						  }
						  return 0;
						});
						var mapRow = addRow(spatial[0]);
						spatial.forEach(function(key){
							addRow(key);
						});
						var mapCell = mapRow.insertCell(-1);
						mapCell.setAttribute("rowspan",spatial.length);
						mapCell.setAttribute("colspan",2);
						mapCell.setAttribute("width","50%");
						mapDiv = document.createElement('div');
						mapDiv.setAttribute("style","height: "+(spatial.length * 36)+"px;");
						mapCell.appendChild(mapDiv);
					}
					addPair("Northernmost_Northing", "Easternmost_Easting");
					addPair("Southernmost_Northing", "Westernmost_Easting");
					var irow = addRow("time_coverage_start");
					if(irow){
						addItem("time_coverage_end");
					}

					Object.keys(metadata).forEach(function(key){
							addRow(key,3);
					});
					el.innerText = "";
					el.appendChild(innerTable);
					if(mapDiv){
						var map = L.map(mapDiv,{attributionControl: false});
						L.control.attribution({position: "bottomleft"}).addTo(map);
						L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
						    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
						}).addTo(map);
						map.fitBounds(bounds);
						if(point){
							var marker = L.marker(point).addTo(map);
							marker.bindPopup(metadata["title"]).openPopup();
							map.setView(point,9);
						}else{
							L.rectangle(bounds, {color: "#ff7800", weight: 1}).addTo(map);
						}
					}


				})
			}.bind(expand));
		}
		return el;
	}
	if(data && data.length){
		data.forEach(function(o){
			tbody.appendChild(tr(o));
			//getDatasetInfo(o.Info).then(info => {
			//	tbody.appendChild(tr(info));
			//})
		});
	}else{
		tbody.appendChild(tr({title: "No results found"}))

	}
}
var setSearchStatus = function(text){
    document.getElementById("searchInfo").innerText = text || "";
}
var clearSearchResults = function(info){
	document.getElementById("searchResults").innerHTML = "";
}
var filterServers = function(){
	var table = document.getElementById("settingsTable");
	if(table){
		var filters = document.getElementById("filter").value.split(/\s+/).map(function(t){return t.toLowerCase();});
		var rows = table.rows;
		var n = table.rows.length;
		for(var i=1;i<n;i++ ){//skip header row
			if(filters.length){
				var include = true;
				var text = rows[i].innerText.toLowerCase();
				for(var j=0;j<filters.length;j++){
					if(text.indexOf(filters[j])<0){
						include = false;
						break;
					}
				}
				rows[i].style.display = include?"table-row":"none";
				rows[i].erddap.visible = include;
			}else{
				rows[i].style.display = "table-row";

			}
		}
	}
}
var clearFilterServers = function(){
	var filter = document.getElementById("filter");
	filter.value = "";
	filter.focus();
	filterServers();
}
var clearSearchDatasets = function(){
    setSearchStatus("");
	clearSearchResults();
	history.pushState("", document.title, window.location.pathname
                                                       + window.location.search);
}
var ERDDAPs = function(configs,includeCustomConfigs){
    this.erddaps = configs.map(function(e){return new ERDDAP(e)});
    if(includeCustomConfigs){
    	var customErddaps = this.getCustomConfigs().map(function(e){return new ERDDAP(e)});
    	for(var i=customErddaps.length-1;i>=0;i--){
    		var include = true;
    		for(var j=0;j<this.erddaps.length; j++){
    			if(this.erddaps[j].endpoint == customErddaps[i].endpoint){
    				include = false;
    				break;
    			}
    		}
    		if(include){
    			this.erddaps.unshift(customErddaps[i]);
    		}
    	}
    	this.saveCustomConfigs();
    }
    this.searchId = 0;
}
ERDDAPs.prototype.testConnect = function(){
	var nerddaps = this.erddaps.length;
	var remaining = nerddaps;
	document.getElementById("testConnections").style.display='block';
	var showTestConnectionStatus = function(){
		document.getElementById("testConnections").innerText = "Testing "+nerddaps+" ERDDAP connections, waiting for "+ --remaining;
	}
	    var promises = this.erddaps.map(function(erddap){return erddap.testConnect().then(function(){
	    	showTestConnectionStatus();
	    })});
	    return Promise.all(promises).then(function(){
	    				document.getElementById("testConnections").style.display='none';
	    });
}
ERDDAPs.prototype.search = function(query){
	clearSearchResults("");
    var currentSearchId = ++this.searchId;
	if(query){
		console.log("searching: "+query);
        var starTime = new Date().getTime();
		var urlParams = getUrlSearchParams();
		urlParams.set("search",query);
		history.replaceState(null, null, document.location.pathname + '#'+urlParams.toString());
		var erddaps = this.erddaps.filter(function(erddap){
			//console.log(erddap);
			return erddap && erddap.settings && erddap.settings.connected && !erddap.settings.disabled;
		});
        var nsearches = erddaps.length;
        var nerddaps = nsearches;
        setSearchStatus("Searching "+nsearches+"/"+nerddaps+" erddaps");
        var table = document.createElement("table");
        table.setAttribute("class","table");
        var thead = document.createElement("thead");
        table.appendChild(thead);
        var tr = document.createElement("tr");
        thead.appendChild(tr);
        var th = function(text){
            var el = document.createElement("th");
            el.setAttribute('scope','col');
            el.appendChild(document.createTextNode(text));
            return el;
        }
        tr.appendChild(th(""));
        tr.appendChild(th("Title"));
        tr.appendChild(th("Institution"));
        tr.appendChild(th("Dataset"));
        var tbody = document.createElement("tbody");
        table.appendChild(tbody);
        var nerddapResults = 0;
                var showSearchResultStatus = function(){
	                var status = nsearches?("Searching "+nsearches+"/"+nerddaps+" ERDDAP server"+(nsearches>1?"s":"")):("Searched "+nerddaps+" ERDDAP server"+(nerddaps>1?"s":""));
	                var found = "found "+tbody.rows.length + " dataset"+(tbody.rows.length==1?"":"s");
	                found += " from "+nerddapResults+" server"+(nerddapResults==1?"":"s");
	                var timing = "total search time "+ (new Date().getTime()-starTime)+"ms.";
	                setSearchStatus([status,found, timing].join("; "));
                }

        erddaps.forEach(function(erddap){
            erddap.search(query).then(function(result){
                if(currentSearchId != this.searchId){
                    return;
                }
                --nsearches;
                if(result && result.data){
                    if(++nerddapResults == 1){
                        document.getElementById("searchResults").appendChild(table);
                    }
                    showSearchResults(table,tbody,result.data);
                }
                showSearchResultStatus();
            }.bind(this),function(){--nsearches;showSearchResultStatus();}
            ).catch(function(err){
            	console.log(err);
            	--nsearches;showSearchResultStatus();
            });
        }.bind(this));
	}
}
ERDDAPs.prototype.settingstable = function(){
	this.erddaps = this.erddaps.filter(function(erddap){return !erddap.deleted});
	var table = document.createElement("table");
	table.setAttribute("id","settingsTable");
	table.setAttribute("class","table");
	var thead = document.createElement("thead");
	var tr = document.createElement("tr");
	var th = document.createElement("th");
	var cb = document.createElement("input");
	cb.setAttribute("type","checkbox");
	th.appendChild(cb);
	tr.appendChild(th);
	th = document.createElement("th");
	tr.appendChild(th);
	th = document.createElement("th");
	th.appendChild(document.createTextNode("Name"));
	tr.appendChild(th);
	th = document.createElement("th");
	th.appendChild(document.createTextNode("Url"));
	tr.appendChild(th);
	th = document.createElement("th");
	tr.appendChild(th);
	thead.appendChild(tr);
	table.appendChild(thead);
	var tbody = document.createElement("tbody");
	for(var i=0;i<this.erddaps.length;i++){
		tr = this.erddaps[i].settingstr(this,i);
		this.erddaps[i].tr = tr;
		this.erddaps[i].visible = true;
		tr.erddap = this.erddaps[i];
		tbody.appendChild(tr);
	}
	cb.setAttribute("title","Click to enable/disable listed servers");
	cb.onclick = function(){
		console.log("clicked")
		var rows = table.rows;
		var n = table.rows.length;
		for(var i=1;i<n;i++ ){//skip header row
			var erddap = rows[i].erddap;
			if(erddap.visible && erddap.settings.connected){ // hmmn could just use css selector...
				rows[i].querySelector("input").checked = this.checked;
				erddap.setDisabled(!this.checked);
			}
		}

	}
	table.appendChild(tbody);
	return table;
}
function isValidURL(str) {
	//https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
   var a  = document.createElement('a');
   a.href = str;
   return (a.host && a.host != window.location.host);
}
ERDDAPs.prototype.getCustomConfigs = function(){
	return JSON.parse(localStorage.getItem("custom") || "[]");
}
ERDDAPs.prototype.saveCustomConfigs = function(){
	localStorage.setItem("custom",JSON.stringify(this.erddaps.filter(function(k){return k.settings.custom && !k.deleted;}).map(function(e){return e.settings;})));
}
ERDDAPs.prototype.showServersList = function(){
		document.getElementById("erddapServers").innerHTML= "";
		document.getElementById("erddapServers").appendChild(this.settingstable());
		this.saveCustomConfigs()
		filterServers();	
}
ERDDAPs.prototype.addNewServerFromForm = function(){
	var urlhelp = document.getElementById("newServerUrlHelpBlock");
	urlhelp.innerText = "";
	var urlel = document.getElementById("newServerUrl");
	var url = urlel.value.trim();
	if(url.length == 0){
		hideAddServerForm();
		return;
	}
	if(!isValidURL(url)){
		urlhelp.innerText = "Not a valid URL";
		return;
	}
	var name = document.getElementById("newServerName").value.trim();
	var e2 = new ERDDAPs([{name: name, url: url, custom: true}]);
	for(var i=0;i<this.erddaps.length; i++){
		if(e2.erddaps[0].endpoint == this.erddaps[i].endpoint){
			urlhelp.innerText = "Server is already listed";
			return;
		}
	}
	e2.testConnect().then(function(){
		this.erddaps.unshift(e2.erddaps[0]);
		this.showServersList();
		hideAddServerForm();
	}.bind(this));

}

var showAddServerForm = function(){
	document.getElementById("newServerUrlHelpBlock").innerText = "";
	document.getElementById("newServerUrl").value = "";
	document.getElementById("newServerName").value = "";
	document.getElementById("addServerForm").style.display = "block";
	document.getElementById("configureErddapServer").style.display = "none";
	document.getElementById("erddapServers").style.display = "none";
	document.getElementById("newServerName").focus();
}
var hideAddServerForm = function(){
	document.getElementById("addServerForm").style.display = "none";
	document.getElementById("configureErddapServer").style.display = "block";
	document.getElementById("erddapServers").style.display = "block";
}

var showSettings = function(){
	document.getElementById("searchArea").style.display = "none";
	document.getElementById("configurationArea").style.display = "block";
}
var showSearch = function(){
	hideAddServerForm();
	document.getElementById("configurationArea").style.display = "none";
	document.getElementById("searchArea").style.display = "block";
}