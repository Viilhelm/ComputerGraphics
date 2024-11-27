#version 420
/* WARNNING: the following must match the values in lab6_main.cpp
	 */
#define SOLUTION_USE_BUILTIN_SHADOW_TEST 1

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
uniform int has_emission_texture;
layout(binding = 5) uniform sampler2D emissiveMap;

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
in vec4 shadowMapCoord;

///////////////////////////////////////////////////////////////////////////////
// Input uniform variables
///////////////////////////////////////////////////////////////////////////////
uniform mat4 viewInverse;
uniform vec3 viewSpaceLightPosition;
uniform mat4 lightMatrix;
uniform vec3 viewSpaceLightDir;
uniform float spotOuterAngle;
uniform float spotInnerAngle;
uniform int useSpotLight;
uniform int useSoftFalloff;



///////////////////////////////////////////////////////////////////////////////
// Output color
///////////////////////////////////////////////////////////////////////////////
layout(location = 0) out vec4 fragmentColor;
//layout(binding = 10) uniform sampler2D shadowMapTex;
layout(binding = 10) uniform sampler2DShadow shadowMapTex;



vec3 calculateDirectIllumiunation(vec3 wo, vec3 n, vec3 base_color)
{
	vec3 direct_illum = base_color;
	
	vec3 wi = normalize(viewSpaceLightPosition - viewSpacePosition);
    const float d = length(viewSpaceLightPosition - viewSpacePosition);

	vec3 Li = point_light_intensity_multiplier * point_light_color * (1.0 / (d * d));

	float nDotWi = dot(n, wi);
    if (nDotWi <= 0.0) {
        return vec3(0.0); 
    }

	
		
	vec3 diffuse_term = base_color * (1.0 / PI) * abs(nDotWi) * Li;
	direct_illum = diffuse_term;

	
	vec3 wh = normalize(wi + wo);
	float nDotWh = max(0.0001, dot(n, wh));
	float D = (material_shininess + 2.0) / (2.0 * PI) * pow(nDotWh, material_shininess);

	float whDotWi = max(0.0001, dot(wh, wi));
	float F = material_fresnel + (1.0 - material_fresnel) * pow(1.0 - whDotWi, 5.0);

	float nDotWo = max(0.0001, dot(n, wo)); 
	float whDotWo = max(0.0001, dot(wo, wh));
	float G = min(1.0, min((2.0 * nDotWh * nDotWo) / whDotWo, (2.0 * nDotWh * nDotWi) / whDotWo));

	float brdf = (D * F * G) / (4.0 * clamp(nDotWo * nDotWi, 0.0001, 1.0));

	direct_illum = brdf * nDotWi * Li; // * base_color 

	
	vec3 dielectric_term = brdf * nDotWi * Li + (1.0 - F) * diffuse_term;
	vec3 metal_term = brdf * base_color * nDotWi * Li;

	direct_illum = material_metalness * metal_term + (1.0 - material_metalness) * dielectric_term;

	return direct_illum;
	//return vec3(F);
}

vec3 calculateIndirectIllumination(vec3 wo, vec3 n, vec3 base_color)
{
	vec3 indirect_illum = vec3(0.f);
	
	vec3 n_ws = normalize((viewInverse * vec4(n, 0.0)).xyz);

	float theta = acos(clamp(n_ws.y, -1.0f, 1.0f)); // ¦È: Ñö½Ç
    float phi = atan(n_ws.z, n_ws.x);               // ¦Õ: ·½Î»½Ç
    if(phi < 0.0f) {
        phi += 2.0f * PI;
    }

	vec2 lookup = vec2(phi / (2.0 * PI), 1.0 - theta / PI);
    vec3 irradiance = environment_multiplier * texture(irradianceMap, lookup).rgb;

	vec3 diffuse_term = base_color * (1.0 / PI) * irradiance;
	indirect_illum = diffuse_term;
	
	vec3 wi = normalize(reflect(-wo, n));
    vec3 wi_ws = normalize((viewInverse * vec4(wi, 0.0)).xyz);

	float spec_theta = acos(clamp(wi_ws.y, -1.0f, 1.0f));
    float spec_phi = atan(wi_ws.z, wi_ws.x);
    if(spec_phi < 0.0f) {
        spec_phi += 2.0f * PI;
    }
    vec2 spec_lookup = vec2(spec_phi / (2.0 * PI), 1.0 - spec_theta / PI);

	float roughness = sqrt(sqrt(2.0f / (material_shininess + 2.0))); 
    vec3 Li = environment_multiplier * textureLod(reflectionMap, spec_lookup, roughness * 7.0f).rgb;

	vec3 wh = normalize(wi + wo);
	float whDotWi = max(0.0001, dot(wh, wi));
	float F = material_fresnel + (1.0 - material_fresnel) * pow(1.0 - whDotWi, 5.0);

	vec3 dielectric_term = F * Li + (1.0 - F) * diffuse_term;
	vec3 metal_term = F * base_color * Li;

	indirect_illum = material_metalness * metal_term + (1.0 - material_metalness) * dielectric_term;

	return indirect_illum;
}

void main()
{
	float visibility = 1.0;
	float attenuation = 1.0;

	//vec4 shadowMapCoord = lightMatrix * vec4(viewSpacePosition, 1.f);
	vec3 wo = -normalize(viewSpacePosition);
	vec3 n = normalize(viewSpaceNormal);

	vec3 base_color = material_color;
	if(has_color_texture == 1)
	{
		base_color = texture(colorMap, texCoord).rgb;
	}

	//float depth = texture(shadowMapTex, shadowMapCoord.xy / shadowMapCoord.w).x;
	//visibility = (depth >= (shadowMapCoord.z / shadowMapCoord.w)) ? 1.0 : 0.0;
	visibility = textureProj(shadowMapTex, shadowMapCoord);

	if(useSpotLight == 1)
	{
		vec3 posToLight = normalize(viewSpaceLightPosition - viewSpacePosition);
		float cosAngle = dot(posToLight, -viewSpaceLightDir);

		if(useSoftFalloff == 0)
		{
			// Spotlight with hard border:
			attenuation = (cosAngle > spotOuterAngle) ? 1.0 : 0.0;
		}
		else
		{
			// Spotlight with soft border:
			attenuation = smoothstep(spotOuterAngle, spotInnerAngle, cosAngle);
		}

		visibility *= attenuation;
	}

	// Direct illumination
	vec3 direct_illumination_term = visibility * calculateDirectIllumiunation(wo, n, base_color);

	// Indirect illumination
	vec3 indirect_illumination_term = calculateIndirectIllumination(wo, n, base_color);

	///////////////////////////////////////////////////////////////////////////
	// Add emissive term. If emissive texture exists, sample this term.
	///////////////////////////////////////////////////////////////////////////
	vec3 emission_term = material_emission;
	if(has_emission_texture == 1)
	{
		emission_term = texture(emissiveMap, texCoord).rgb;
	}

	vec3 shading = direct_illumination_term + indirect_illumination_term + emission_term;

	fragmentColor = vec4(shading, 1.0);
	return;
}
