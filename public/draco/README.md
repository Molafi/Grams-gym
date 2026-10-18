Place the Draco decoder files here only if you upload compressed `.glb` product models
(the `glbUrl` field). Copy them from `node_modules/three/examples/jsm/libs/draco/gltf/`:

    cp node_modules/three/examples/jsm/libs/draco/gltf/* public/draco/

They are served locally so the Content-Security-Policy does not need a third-party CDN.
