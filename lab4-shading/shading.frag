#version 420

// required by GLSL spec Sect 4.5.3 (though nvidia does not, amd does)
precision highp float;

///////////////////////////////////////////////////////////////////////////////
// Material
///////////////////////////////////////////////////////////////////////////////
uniform vec3 material_color;
uniform float material_metalness;
uniform float material_fresnel;
uniform float material_shininess;
uniform vec3 material_emission;

uniform int has_color_texture;
layout(binding = 0) uniform sampler2D colorMap;

///////////////////////////////////////////////////////////////////////////////
// Environment
///////////////////////////////////////////////////////////////////////////////
layout(binding = 6) uniform sampler2D environmentMap;
layout(binding = 7) uniform sampler2D irradianceMap;
layout(binding = 8) uniform sampler2D reflectionMap;
uniform float environment_multiplier;

///////////////////////////////////////////////////////////////////////////////
// Light source
///////////////////////////////////////////////////////////////////////////////
uniform vec3 point_light_color = vec3(1.0, 1.0, 1.0);
uniform float point_light_intensity_multiplier = 50.0;

///////////////////////////////////////////////////////////////////////////////
// Constants
///////////////////////////////////////////////////////////////////////////////
#define PI 3.14159265359

///////////////////////////////////////////////////////////////////////////////
// Input varyings from vertex shader
///////////////////////////////////////////////////////////////////////////////
in vec2 texCoord;
in vec3 viewSpaceNormal;
in vec3 viewSpacePosition;

///////////////////////////////////////////////////////////////////////////////
// Input uniform variables
///////////////////////////////////////////////////////////////////////////////
uniform mat4 viewInverse;
uniform vec3 viewSpaceLightPosition;

///////////////////////////////////////////////////////////////////////////////
// Output color
///////////////////////////////////////////////////////////////////////////////
layout(location = 0) out vec4 fragmentColor;


vec3 calculateDirectIllumiunation(vec3 wo, vec3 n, vec3 base_color)
{
	vec3 direct_illum = base_color;
	///////////////////////////////////////////////////////////////////////////
	// Task 1.2 - Calculate the radiance Li from the light, and the direction
	//            to the light. If the light is backfacing the triangle,
	//            return vec3(0);
	///////////////////////////////////////////////////////////////////////////
	vec3 wi = normalize(viewSpaceLightPosition - viewSpacePosition);
    const float d = length(viewSpaceLightPosition - viewSpacePosition);

	vec3 Li = point_light_intensity_multiplier * point_light_color * (1.0 / (d * d));

	float nDotWi = dot(n, wi);
    if (nDotWi <= 0.0) {
        return vec3(0.0); 
    }

	///////////////////////////////////////////////////////////////////////////
	// Task 1.3 - Calculate the diffuse term and return that as the result
	///////////////////////////////////////////////////////////////////////////
	// vec3 diffuse_term = ...
		
	vec3 diffuse_term = base_color * (1.0 / PI) * abs(nDotWi) * Li;
	direct_illum = diffuse_term;

	///////////////////////////////////////////////////////////////////////////
	// Task 2 - Calculate the Torrance Sparrow BRDF and return the light
	//          reflected from that instead
	///////////////////////////////////////////////////////////////////////////
	vec3 wh = normalize(wi + wo);
	float nDotWh = max(0.0001, dot(n, wh));
	float D = (material_shininess + 2.0) / (2.0 * PI) * pow(nDotWh, material_shininess);

	float whDotWi = max(0.0001, dot(wh, wi));
	float F = material_fresnel + (1.0 - material_fresnel) * pow(1.0 - whDotWi, 5.0);

	float nDotWo = max(0.0001, dot(n, wo)); 
	float whDotWo = max(0.0001, dot(wo, wh));
	float G = min(1.0, min((2.0 * nDotWh * nDotWo) / whDotWo, (2.0 * nDotWh * nDotWi) / whDotWo));

	float brdf = (D * F * G) / (4.0 * clamp(nDotWo * nDotWi, 0.0001, 1.0));

	direct_illum = brdf * nDotWi * Li;

	///////////////////////////////////////////////////////////////////////////
	// Task 3 - Make your shader respect the parameters of our material model.
	///////////////////////////////////////////////////////////////////////////

	return direct_illum;
}

vec3 calculateIndirectIllumination(vec3 wo, vec3 n, vec3 base_color)
{
	vec3 indirect_illum = vec3(0.f);
	///////////////////////////////////////////////////////////////////////////
	// Task 5 - Lookup the irradiance from the irradiance map and calculate
	//          the diffuse reflection
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// Task 6 - Look up in the reflection map from the perfect specular
	//          direction and calculate the dielectric and metal terms.
	///////////////////////////////////////////////////////////////////////////

	return indirect_illum;
}


void main()
{
	///////////////////////////////////////////////////////////////////////////
	// Task 1.1 - Fill in the outgoing direction, wo, and the normal, n. Both
	//            shall be normalized vectors in view-space.
	///////////////////////////////////////////////////////////////////////////
	vec3 wo = normalize(-viewSpacePosition); 
    vec3 n = normalize(viewSpaceNormal); 

	vec3 base_color = material_color;
	if(has_color_texture == 1)
	{
		base_color *= texture(colorMap, texCoord).rgb;
	}

	vec3 direct_illumination_term = vec3(0.0);
	{ // Direct illumination
		direct_illumination_term = calculateDirectIllumiunation(wo, n, base_color);
	}

	vec3 indirect_illumination_term = vec3(0.0);
	{ // Indirect illumination
		indirect_illumination_term = calculateIndirectIllumination(wo, n, base_color);
	}

	///////////////////////////////////////////////////////////////////////////
	// Task 1.4 - Make glowy things glow!
	///////////////////////////////////////////////////////////////////////////
	vec3 emission_term = material_emission; //material_emission * material_color;

	vec3 final_color = direct_illumination_term + indirect_illumination_term + emission_term;

	// Check if we got invalid results in the operations
	if(any(isnan(final_color)))
	{
		final_color.rgb = vec3(1.f, 0.f, 1.f);
	}

	fragmentColor.rgb = final_color;
}
