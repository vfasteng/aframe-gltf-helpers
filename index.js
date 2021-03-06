/* global AFRAME */

if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

var LOADING_MODELS = {};
var MODELS = {};

AFRAME.registerComponent('gltf-part-plus', {
  schema: {
    buffer: { default: true },
    part: { type: 'string' },
    src: { type: 'asset' },
    resetPosition: { default: false }
  },

  init: function () {
    this.dracoLoader = document
      .querySelector('a-scene')
      .systems['gltf-model'].getDRACOLoader();
  },

  update: function () {
    var el = this.el;
    var data = this.data;
    if (!this.data.part && this.data.src) {
      return;
    }
    this.getModel(function (modelPart) {
      if (!modelPart) {
        return;
      }
      if (data.resetPosition) {
        el.setAttribute(
          'position',
          modelPart.position.x +
            ' ' +
            modelPart.position.y +
            ' ' +
            modelPart.position.z
        );

        modelPart.position.set(0, 0, 0);
      }
      el.setObject3D('mesh', modelPart);
      el.emit('model-loaded', {format: 'gltf', part: this.modelPart});
    });
  },

  /**
   * Fetch, cache, and select from GLTF.
   *
   * @returns {object} Selected subset of model.
   */
  getModel: function (cb) {
    var self = this;

    // Already parsed, grab it.
    if (MODELS[this.data.src]) {
      cb(this.selectFromModel(MODELS[this.data.src]));
      return;
    }

    // Currently loading, wait for it.
    if (LOADING_MODELS[this.data.src]) {
      return LOADING_MODELS[this.data.src].then(function (model) {
        cb(self.selectFromModel(model));
      });
    }

    // Not yet fetching, fetch it.
    LOADING_MODELS[this.data.src] = new Promise(function (resolve) {
      var loader = new THREE.GLTFLoader();
      if (self.dracoLoader) {
        loader.setDRACOLoader(self.dracoLoader);
      }
      loader.load(
        self.data.src,
        function (gltfModel) {
          var model = gltfModel.scene || gltfModel.scenes[0];
          MODELS[self.data.src] = model;
          delete LOADING_MODELS[self.data.src];
          cb(self.selectFromModel(model));
          resolve(model);
        },
        function () {},
        console.error
      );
    });
  },

  /**
   * Search for the part name and look for a mesh.
   */
  selectFromModel: function (model) {
    var mesh;
    var part;

    part = model.getObjectByName(this.data.part);
    if (!part) {
      console.error('[gltf-part] `' + this.data.part + '` not found in model.');
      return;
    }

    mesh = part.getObjectByProperty('type', 'Mesh').clone(true);

    if (this.data.buffer) {
      mesh.geometry = mesh.geometry.toNonIndexed();
      return mesh;
    }
    mesh.geometry = new THREE.Geometry().fromBufferGeometry(mesh.geometry);
    return mesh;
  }
});

AFRAME.registerComponent('model-center', {
  schema: {
    bottomAlign: { default: false }
  },
  init: function () {
    this.el.addEventListener('model-loaded', (event) => {
      var modelPart = this.el.getObject3D('mesh');
      modelPart.position.set ( 0, 0, 0 );
      // center all axes
      modelPart.geometry.center();
      if (this.data.bottomAlign) {
        // align the bottom of the geometry on the y axis
        var box = new THREE.Box3().setFromObject(modelPart);
        var boundingBoxSize = box.max.sub(box.min);
        var height = boundingBoxSize.y;
        modelPart.position.y = height / 2;
      }
    });
  }
});

AFRAME.registerComponent('anisotropy', {
  schema: { default: 0 }, // default 0 will apply max anisotropy according to hardware
  dependencies: ['material', 'geometry'],
  init: function () {
    this.maxAnisotropy = this.el.sceneEl.renderer.capabilities.getMaxAnisotropy();
    // console.log('this.maxAnisotropy', this.maxAnisotropy);

    this.el.addEventListener('model-loaded', () => {
      const mesh = this.el.getObject3D('mesh');
      // console.log('mesh', mesh);

      var anisotropyTargetValue = this.data;
      anisotropyTargetValue = +anisotropyTargetValue || 0; // https://stackoverflow.com/questions/7540397/convert-nan-to-0-in-javascript
      // console.log('anisotropyTargetValue', anisotropyTargetValue);

      if (anisotropyTargetValue === 0) {
        anisotropyTargetValue = this.maxAnisotropy;
        // console.log('anisotropyTargetValue', anisotropyTargetValue);
      }

      mesh.traverse((object) => {
        if (object.isMesh === true && object.material.map !== null) {
          // console.log('object', object);
          // console.log('object.material.map.anisotropy', object.material.map.anisotropy);
          object.material.map.anisotropy = anisotropyTargetValue;
          // console.log('object.material.map.anisotropy', object.material.map.anisotropy);
          object.material.map.needsUpdate = true;
        }
      });
    });
  }
});
