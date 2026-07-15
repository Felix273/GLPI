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

/* pages/login.html.twig */
class __TwigTemplate_84af4058c48d60a5855301c0199aaec9 extends Template
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

        $this->blocks = [
            'content_block' => [$this, 'block_content_block'],
            'footer_block' => [$this, 'block_footer_block'],
            'javascript_block' => [$this, 'block_javascript_block'],
        ];
    }

    protected function doGetParent(array $context)/*: bool|string|Template|TemplateWrapper*/
    {
        // line 33
        return "layout/page_card_notlogged.html.twig";
    }

    protected function doDisplay(array $context, array $blocks = []): iterable
    {
        $macros = $this->macros;
        $this->parent = $this->load("layout/page_card_notlogged.html.twig", 33);
        yield from $this->parent->unwrap()->yield($context, array_merge($this->blocks, $blocks));
    }

    // line 35
    /**
     * @return iterable<null|scalar|\Stringable>
     */
    public function block_content_block(array $context, array $blocks = []): iterable
    {
        $macros = $this->macros;
        // line 36
        yield "   <form action=\"";
        yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape($this->extensions['Glpi\Application\View\Extension\RoutingExtension']->path("front/login.php"), "html", null, true);
        yield "\" method=\"post\" autocomplete=\"off\"  data-submit-once>
      <input type=\"hidden\" name=\"noAUTO\" value=\"";
        // line 37
        yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(($context["noAuto"] ?? null), "html", null, true);
        yield "\" />
      <input type=\"hidden\" name=\"redirect\" value=\"";
        // line 38
        yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(($context["redirect"] ?? null), "html", null, true);
        yield "\" />
      <input type=\"hidden\" name=\"_glpi_csrf_token\" value=\"";
        // line 39
        yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(Session::getNewCSRFToken(), "html", null, true);
        yield "\" />

      <div class=\"row justify-content-center\">
         <div class=\"col-md-5\">
            <div class=\"card-header mb-4\">
               <h2 class=\"mx-auto\">";
        // line 44
        yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(__("Login to your account"), "html", null, true);
        yield "</h2>
            </div>
            <div class=\"mb-3\">
               <label class=\"form-label\" for=\"login_name\">";
        // line 47
        yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(__("Login"), "html", null, true);
        yield "</label>
               <input type=\"text\" class=\"form-control\" id=\"login_name\" name=\"";
        // line 48
        yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(($context["namfield"] ?? null), "html", null, true);
        yield "\" placeholder=\"\" tabindex=\"1\" />
            </div>
            <div class=\"mb-4\">
               <label class=\"form-label\" for=\"login_password\">
                  ";
        // line 52
        yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(__("Password"), "html", null, true);
        yield "

                  ";
        // line 54
        if ((($tmp = ($context["show_lost_password"] ?? null)) && $tmp instanceof Markup ? (string) $tmp : $tmp)) {
            // line 55
            yield "                     <span class=\"form-label-description\">
                        <a href=\"";
            // line 56
            yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape($this->extensions['Glpi\Application\View\Extension\RoutingExtension']->path("front/lostpassword.php?lostpassword=1"), "html", null, true);
            yield "\">
                           ";
            // line 57
            yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(__("Forgotten password?"), "html", null, true);
            yield "
                        </a>
                     </span>
                  ";
        }
        // line 61
        yield "               </label>
               <input type=\"password\" class=\"form-control\" id=\"login_password\" name=\"";
        // line 62
        yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(($context["pwdfield"] ?? null), "html", null, true);
        yield "\" placeholder=\"\" autocomplete=\"off\" tabindex=\"2\" />
            </div>

            ";
        // line 65
        if ((($tmp = Twig\Extension\CoreExtension::constant("GLPI_DEMO_MODE")) && $tmp instanceof Markup ? (string) $tmp : $tmp)) {
            // line 66
            yield "               <div class=\"mb-3\">
                  <label class=\"form-label\" for=\"dropdown_language";
            // line 67
            yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(($context["rand"] ?? null), "html", null, true);
            yield "\">";
            yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(__("Language"), "html", null, true);
            yield "</label>
                  ";
            // line 68
            yield ($context["languages_dropdown"] ?? null);
            yield "
               </div>
            ";
        }
        // line 71
        yield "
            ";
        // line 72
        if ((($tmp = $this->extensions['Glpi\Application\View\Extension\ConfigExtension']->config("display_login_source")) && $tmp instanceof Markup ? (string) $tmp : $tmp)) {
            // line 73
            yield "               <div class=\"mb-3\">
                  <label class=\"form-label\" for=\"dropdown_auth";
            // line 74
            yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(($context["rand"] ?? null), "html", null, true);
            yield "\">";
            yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(__("Login source"), "html", null, true);
            yield "</label>
                  ";
            // line 75
            yield ($context["auth_dropdown_login"] ?? null);
            yield "
               </div>
            ";
        }
        // line 78
        yield "
            ";
        // line 79
        if ((($tmp = $this->extensions['Glpi\Application\View\Extension\ConfigExtension']->config("login_remember_time")) && $tmp instanceof Markup ? (string) $tmp : $tmp)) {
            // line 80
            yield "               <div class=\"mb-2\">
                  <label class=\"form-check\" for=\"login_remember\">
                     <input type=\"checkbox\" class=\"form-check-input\" id=\"login_remember\" name=\"";
            // line 82
            yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(($context["rmbfield"] ?? null), "html", null, true);
            yield "\" ";
            yield (((($tmp = $this->extensions['Glpi\Application\View\Extension\ConfigExtension']->config("login_remember_default")) && $tmp instanceof Markup ? (string) $tmp : $tmp)) ? ("checked") : (""));
            yield " />
                     <span class=\"form-check-label\">";
            // line 83
            yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(__("Remember me"), "html", null, true);
            yield "</span>
                  </label>
               </div>
            ";
        }
        // line 87
        yield "
            <div class=\"form-footer\">
               <button type=\"submit\" name=\"submit\" class=\"btn btn-primary w-100\" tabindex=\"3\">
                  ";
        // line 90
        yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(__("Sign in"), "html", null, true);
        yield "
               </button>
            </div>

            ";
        // line 94
        if ((Twig\Extension\CoreExtension::length($this->env->getCharset(), ($context["errors"] ?? null)) > 0)) {
            // line 95
            yield "               <hr />
               <div class=\"alert alert-danger\" role=\"alert\">
                  ";
            // line 97
            yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(($context["errors"] ?? null), "html", null, true);
            yield "
               </div>
            ";
        }
        // line 100
        yield "         </div>

         ";
        // line 102
        if ((($tmp = ($context["right_panel"] ?? null)) && $tmp instanceof Markup ? (string) $tmp : $tmp)) {
            // line 103
            yield "            <div class=\"col-auto px-2 text-center\">
               ";
            // line 104
            if ((Twig\Extension\CoreExtension::length($this->env->getCharset(), ($context["text_login"] ?? null)) > 0)) {
                // line 105
                yield "                  <div class=\"rich_text_container\">
                     ";
                // line 106
                yield $this->extensions['Glpi\Application\View\Extension\DataHelpersExtension']->getSafeHtml(($context["text_login"] ?? null));
                yield "
                  </div>
               ";
            }
            // line 109
            yield "
               ";
            // line 110
            if ((($tmp = $this->extensions['Glpi\Application\View\Extension\ConfigExtension']->config("use_public_faq")) && $tmp instanceof Markup ? (string) $tmp : $tmp)) {
                // line 111
                yield "                  <hr />

                  <a class=\"btn btn-outline-secondary btn-icon\" href=\"front/helpdesk.faq.php\">
                     <i class=\"fas fa-question\"></i>&nbsp;
                     ";
                // line 115
                yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape(__("FAQ"), "html", null, true);
                yield "
                  </a>
               ";
            }
            // line 118
            yield "
               ";
            // line 119
            yield $this->env->getRuntime('Twig\Runtime\EscaperRuntime')->escape($this->extensions['Glpi\Application\View\Extension\PluginExtension']->callPluginHook(Twig\Extension\CoreExtension::constant("Glpi\\Plugin\\Hooks::DISPLAY_LOGIN")), "html", null, true);
            yield "
            </div>
         ";
        }
        // line 122
        yield "      </div>
   </form>
";
        yield from [];
    }

    // line 126
    /**
     * @return iterable<null|scalar|\Stringable>
     */
    public function block_footer_block(array $context, array $blocks = []): iterable
    {
        $macros = $this->macros;
        // line 127
        yield "   ";
        yield ($context["copyright_message"] ?? null);
        yield "
";
        yield from [];
    }

    // line 130
    /**
     * @return iterable<null|scalar|\Stringable>
     */
    public function block_javascript_block(array $context, array $blocks = []): iterable
    {
        $macros = $this->macros;
        // line 131
        yield "<script type=\"text/javascript\">
   \$(function () {
\$(\x27#login_name\x27).focus();
});
</script>
";
        yield from [];
    }

    /**
     * @codeCoverageIgnore
     */
    public function getTemplateName(): string
    {
        return "pages/login.html.twig";
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
        return array (  286 => 131,  279 => 130,  271 => 127,  264 => 126,  257 => 122,  251 => 119,  248 => 118,  242 => 115,  236 => 111,  234 => 110,  231 => 109,  225 => 106,  222 => 105,  220 => 104,  217 => 103,  215 => 102,  211 => 100,  205 => 97,  201 => 95,  199 => 94,  192 => 90,  187 => 87,  180 => 83,  174 => 82,  170 => 80,  168 => 79,  165 => 78,  159 => 75,  153 => 74,  150 => 73,  148 => 72,  145 => 71,  139 => 68,  133 => 67,  130 => 66,  128 => 65,  122 => 62,  119 => 61,  112 => 57,  108 => 56,  105 => 55,  103 => 54,  98 => 52,  91 => 48,  87 => 47,  81 => 44,  73 => 39,  69 => 38,  65 => 37,  60 => 36,  53 => 35,  42 => 33,);
    }

    public function getSourceContext(): Source
    {
        return new Source("", "pages/login.html.twig", "/home/felix/FENTECH PROJECTS/GLPI/glpi/templates/pages/login.html.twig");
    }
}
