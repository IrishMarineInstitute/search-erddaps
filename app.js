var ERDDAP = function(settings){
    this.settings = settings;
	this.endpoint = settings.url;
}

var e2o = function(data){
	var keys = data.table.columnNames;
	var results = [];
	data.table.rows.forEach(row=>{
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
	results.data.forEach(x => {
		if(x["Variable Name"] == "NC_GLOBAL"){
			info[x["Attribute Name"]] = x.Value;
		}
	})

	return info;
}
getDatasetInfo = function(url){
	//console.log(url);
	//TODO: use cache
	return fetchJsonp(url,{jsonpCallback: ".jsonp"})
		.then(function(response){
			return response.json();
		}).then(e2o).then(nc_global2o).catch((x)=>{
			console.log("no results from "+url);
		});
}

ERDDAP.prototype.search = function(query){
	var url = this.endpoint + "/search/index.json?";
	var urlParams = new URLSearchParams("?");
	urlParams.set("searchFor",query);
	urlParams.set("page",1);
	urlParams.set("itemsPerPage",10000);
	return fetchJsonp(url + urlParams.toString(),{jsonpCallback: ".jsonp"})
		.then(function(response) {
    		return response.json();
  		})
  		.then(e2o)
  		.catch((x)=>{
			console.log("no results from "+url);
		});
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
				getDatasetInfo(o.Info).then((metadata)=>{
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
							Object.keys(extras[key]).forEach((string)=>{
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

					["title","institution","cdm_data_type","summary","license"].forEach((key)=>{
						addRow(key,3);
					});
					addPair("time_coverage_start","time_coverage_end");
					var spatial = ["geospatial_lat_min","geospatial_lat_max","geospatial_lon_min","geospatial_lon_max"];
					var mapDiv = false;
					var bounds = [];
					var point = false;
					if(spatial.filter(s => metadata[s] !== undefined).length == spatial.length){
						bounds = [[metadata["geospatial_lat_min"],metadata["geospatial_lon_min"]],
									  [metadata["geospatial_lat_max"],metadata["geospatial_lon_max"]]];
						try{
							var parsedRoundedBounds = bounds.map(x=>Math.round(parseFloat(x)*1000));
							if(parsedRoundedBounds[0] == parsedRoundedBounds[1] && parsedRoundedBounds[2] == parsedRoundedBounds[3]){
								point = bounds[0];
							}
						}catch(oh_well){};

						// let's add a map.
						Object.keys(metadata).forEach((key)=>{
							if(key.startsWith("geospatial_") && spatial.indexOf(key)<0)
							spatial.push(key);
						});
						spatial.sort(function(a, b) {
							var sub = (s)=> s.replace("_min","_maa");
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
						spatial.forEach((key)=>{
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

					Object.keys(metadata).forEach((key)=>{
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
		data.forEach((o)=>{
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
var clearSearchDatasets = function(){
    setSearchStatus("");
	clearSearchResults();
}
var ERDDAPs = function(configs){
    this.erddaps = configs.map((e)=>new ERDDAP(e));
    this.searchId = 0;
}
ERDDAPs.prototype.search = function(query){
	clearSearchResults("");
    var currentSearchId = ++this.searchId;
	if(query){
        var starTime = new Date().getTime();
		var urlParams = getUrlSearchParams();
		urlParams.set("search",query);
		history.replaceState(null, null, document.location.pathname + '#'+urlParams.toString());
        var nsearches = this.erddaps.length;
        var nerddaps = nsearches;
        setSearchStatus("Searching "+nsearches+" erddaps");
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

        this.erddaps.forEach(function(erddap){
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
                var status = nsearches?("Searching "+nsearches+" ERDDAP server"+(nsearches>1?"s":"")):("Searched "+nerddaps+" ERDDAP server"+(nerddaps>1?"s":""));
                var found = "found "+tbody.rows.length + " dataset"+(tbody.rows.length==1?"":"s");
                found += " from "+nerddapResults+" server"+(nerddapResults==1?"":"s");
                var timing = "total search time "+ (new Date().getTime()-starTime)+"ms.";
                setSearchStatus([status,found, timing].join("; "));
            }.bind(this));
        }.bind(this));
	}
}