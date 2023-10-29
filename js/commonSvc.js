angular.module("sampleApp").service("commonSvc", function () {
  return {
    getExtension: function (resource, url) {
      //return the value of an extension assuming there is only 1...
      var arExtension = [];
      if (resource && url) {
        resource.extension = resource.extension || [];
        resource.extension.forEach(function (ext) {
          if (ext.url == url) {
            arExtension.push(ext);
          }
        });
      }

      return arExtension;
    },

    makeTree: function (profile) {
      //copied from gb2. Idea is that it uses the local definition of core resources to make display easier...
      let hashId = {}; //hash of id assigned to a path
      let treeData = [];
      let err;

      //construct a hash of paths that have a value in the fsh - so we can bold the element in the tree
      let hashPaths = {};

      //the parent element...
      treeData.push({
        parent: "#",
        id: "root",
        text: profile.header.name,
        data: { v: "v" },
        state: { opened: true, selected: false },
      });

      profile.resourceElements.forEach(function (element, inx) {
        let id = element.uniqueId || element.path;

        hashId[element.path] = id; //element.uniqueId
        //console.log(element.path, element.uniqueId)
        let ar = element.path.split(".");
        let text = ar[ar.length - 1];

        if (ar.length == 2) {
          //off the root

          hashId[element.path] = id; //element.uniqueId
          let node = {
            parent: "root",
            id: id,
            text: text,
            data: element,
            state: { opened: false, selected: false },
          };
          decorateNode(node, element, hashPaths);
          treeData.push(node);
        } else {
          //let parentPath = ar.splice()
          ar.pop();

          let parent = hashId[ar.join(".")];
          if (!parent) {
            //todo - ?need a better way of recording these sorts of errors...
            console.log("Can't find element with path " + ar.join("."));
            err = true;
          } else {
            let child = {
              parent: parent,
              id: id,
              text: text,
              data: element,
              state: { opened: false, selected: false },
            };
            decorateNode(child, element, hashPaths);
            treeData.push(child);
            //treeData.push({parent:parent,id:id,text : text, data:element, state: {opened: false, selected: false}})
          }
        }
      });

      if (err) {
      }

      return treeData;

      function decorateNode(node, element, hashPaths) {
        let attr = {};

        if (element.isExtension) {
          attr.class = "elementExtension";
        } else {
          //have to formally add an 'optional' class else the required colour 'cascades' in the tree...

          if (element.min == 1) {
            attr.class = "required";
            // node['a_attr'] = {class : 'required'};
          } else {
            //otherwise the class is inherited by children
            attr.class = "notrequired";
          }
        }

        //bold if there is data at this path
        if (hashPaths[node.text]) {
          attr.class = "" || attr.class;
          attr.class += " elementHasData";
          node.data.fsh = hashPaths[node.text];
        }
        //console.log(element.min,attr)
        node["li_attr"] = attr;
      }
    },
  };
});
