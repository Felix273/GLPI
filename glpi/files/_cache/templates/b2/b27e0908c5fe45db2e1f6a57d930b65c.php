<?php

use Twig\Environment;
use Twig\Error\LoaderError;
use Twig\Error\RuntimeError;
use Twig\Extension\CoreExtension;
use Twig\Extension\SandboxExtension;
use Twig\Markup;
use Twig\Sandbox\SecurityError;
use Twig\Sandbox\SecurityNotAllowedTagError;
use Twig\Sandbox\SecurityNotAllowedFilterError;
use Twig\Sandbox\SecurityNotAllowedFunctionError;
use Twig\Source;
use Twig\Template;
use Twig\TemplateWrapper;

/* layout/page_card_notlogged.html.twig */
class __TwigTemplate_7978ac32df901349dc219b974954f35b extends Template
{
    private Source $source;
    /**
     * @var array<string, Template>
     */
    private array $macros = [];

    public function __construct(Environment $env)
    {
        parent::__construct($env);

        $this->source = $this->getSourceContext();

        $this->parent = false;

        $this->blocks = [
            'content_block' => [$this, 'block_content_block'],
            'footer_block' => [$this, 'block_footer_block'],
            'javascript_block' => [$this, 'block_javascript_block'],
        ];
    }

    protected function doDisplay(array $context, array $blocks = []): iterable
    {
        $macros = $this->macros;
        // line 32
        yield "
";
        // line 33
        $context["theme"] = $this->extensions['Glpi\Application\View\Extension\ConfigExtension']->config("palette");
        // line 34
        if ((($tmp =  !array_key_exists("css_files", $context)) && $tmp instanceof Markup ? (string) $tmp : $tmp)) {
            // line 35
            yield "   ";
            $context["css_files"] = [["path" => "public/lib/base.css"], ["path" => (("css/palettes/" .             // line 37
($context["theme"] ?? null)) . ".scss")]];
            // line 39
            yield "   ";
        }
        // line 41
        if ((($tmp =  !array_key_exists("js_files", $context)) && $tmp instanceof Markup ? (string) $tmp : $tmp)) {
            // line 42
            yield "   ";
            $context["js_files"] = [["path" => "public/lib/base.js"], ["path" => "js/common.js"], ["path" => "public/lib/fuzzy.js"]];
        }
        // line 48
        if ((($tmp =  !array_key_exists("js_modules", $context)) && $tmp instanceof Markup ? (string) $tmp : $tmp)) {
            // line 49
            yield "   ";
            $context["js_modules"] = [];
        }
        // line 51
        if ((($tmp =  !array_key_exists("custom_header_tags", $context)) && $tmp instanceof Markup ? (string) $tmp : $tmp)) {
            // line 52
            yield "   ";
            $context["custom_header_tags"] = [];
        }
        // line 54
        yield "
";
        // line 56
        $context["js_files"] = Twig\Extension\CoreExtension::merge(($context["js_files"] ?? null), $this->extensions['Glpi\Application\View\Extension\PluginExtension']->getPluginsJsScriptsFiles(true));
        // line 57
        $context["js_modules"] = Twig\Extension\CoreExtension::merge(($context["js_modules"] ?? null), $this->extensions['Glpi\Application\View\Extension\PluginExtension']->getPluginsJsModulesFiles(true));
        // line 58
        yield "
";
        // line 59
        $context["is_anonymous_page"] = true;
        // line 60
        yield "
";
        // line 61
        yield Twig\Extension\CoreExtension::include($this->env, $context, "layout/parts/head.html.twig");
        yield "
<body class=\"welcome-anonymous\">
   <div class=\"page-anonymous\">
      <div class=\"flex-fill d-flex flex-column justify-content-center py-4 mt-4\">
         ";
        // line 65
        $context["style"] = null;
        // line 66
        yield "         ";
        if (array_key_exists("card_md_width", $context)) {
            // line 67
            yield "            ";
            $context["style"] = "max-width: 40rem";
            // line 68
            yield "         ";
        }
        // line 69
        yield "         ";
        if (array_key_exists("card_bg_width", $context)) {
            // line 70
            yield "            ";
            $context["style"] = "max-width: 60rem";
            // line 71
            yield "         ";
        }
        // line 72
        yield "
         <div class=\"container-tight py-6\" ";
        // line 73
        if ((($tmp =  !(null === ($context["style"] ?? null))) && $tmp instanceof Markup ? (string) $tmp : $tmp)) {
            yield "style=\"";
            yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(($context["style"] ?? null), "html", null, true);
            yield "\"";
        }
        yield ">
            <div class=\"text-center\">
               <div class=\"col-md\">
                  <span class=\"glpi-logo mb-4\" title=\"GLPI\"></span>
               </div>
            </div>
            <div class=\"card card-md\">
               <div class=\"card-body\">
               ";
        // line 81
        yield from $this->unwrap()->yieldBlock('content_block', $context, $blocks);
        // line 82
        yield "               </div>
            </div>

            <div class=\"text-center text-muted mt-3\">
               ";
        // line 86
        yield from $this->unwrap()->yieldBlock('footer_block', $context, $blocks);
        // line 87
        yield "            </div>
         </div>
      </div>
   </div>

   ";
        // line 92
        yield from $this->unwrap()->yieldBlock('javascript_block', $context, $blocks);
        // line 93
        yield "</body>
</html>
";
        yield from [];
    }

    // line 81
    /**
     * @return iterable<null|scalar|\Stringable>
     */
    public function block_content_block(array $context, array $blocks = []): iterable
    {
        $macros = $this->macros;
        yield from [];
    }

    // line 86
    /**
     * @return iterable<null|scalar|\Stringable>
     */
    public function block_footer_block(array $context, array $blocks = []): iterable
    {
        $macros = $this->macros;
        yield from [];
    }

    // line 92
    /**
     * @return iterable<null|scalar|\Stringable>
     */
    public function block_javascript_block(array $context, array $blocks = []): iterable
    {
        $macros = $this->macros;
        yield from [];
    }

    /**
     * @codeCoverageIgnore
     */
    public function getTemplateName(): string
    {
        return "layout/page_card_notlogged.html.twig";
    }

    /**
     * @codeCoverageIgnore
     */
    public function isTraitable(): bool
    {
        return false;
    }

    /**
     * @codeCoverageIgnore
     */
    public function getDebugInfo(): array
    {
        return array (  183 => 92,  173 => 86,  163 => 81,  156 => 93,  154 => 92,  147 => 87,  145 => 86,  139 => 82,  137 => 81,  122 => 73,  119 => 72,  116 => 71,  113 => 70,  110 => 69,  107 => 68,  104 => 67,  101 => 66,  99 => 65,  92 => 61,  89 => 60,  87 => 59,  84 => 58,  82 => 57,  80 => 56,  77 => 54,  73 => 52,  71 => 51,  67 => 49,  65 => 48,  61 => 42,  59 => 41,  56 => 39,  54 => 37,  52 => 35,  50 => 34,  48 => 33,  45 => 32,);
    }

    public function getSourceContext(): Source
    {
        return new Source("", "layout/page_card_notlogged.html.twig", "/home/felix/FENTECH PROJECTS/GLPI/glpi/templates/layout/page_card_notlogged.html.twig");
    }
}
