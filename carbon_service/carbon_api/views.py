"""
Carbon API Views — Django REST Framework APIViews.
Each view delegates to the appropriate service/engine module.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import (
    ActivityDataSerializer,
    ForecastRequestSerializer,
    SupplierScoreSerializer,
)
from .services.carbon_calculator import CarbonCalculator
from .services.ml_engine import MLEngine
from .services.recommendation_engine import RecommendationEngine
from .services.csv_processor import CsvProcessorService
from .services.comprehensive_calculator import ComprehensiveCalculator
from .services.recommendation_rules import RecommendationEngineRules


class ComprehensiveCalculationView(APIView):
    """
    POST /api/carbon/calculate-comprehensive/
    Receives Energy, Transport, and Material data and calculates combined footprint.
    """

    def post(self, request):
        data = request.data
        if not data:
            return Response({'error': 'No data provided'}, status=status.HTTP_400_BAD_REQUEST)
            
        calculator = ComprehensiveCalculator()
        result = calculator.calculate_footprint(data)
        
        return Response(result, status=status.HTTP_200_OK)


class GenerateRecommendationsView(APIView):
    """
    POST /api/carbon/generate-recommendations/
    Receives an existing footprint payload and returns rule-based recommendations.
    """
    
    def post(self, request):
        footprint_data = request.data
        if not footprint_data or 'inputs' not in footprint_data or 'results' not in footprint_data:
            return Response({'error': 'Valid footprint data (inputs and results) required'}, status=status.HTTP_400_BAD_REQUEST)
            
        recommendations = RecommendationEngineRules.generate(footprint_data)
        return Response({'recommendations': recommendations}, status=status.HTTP_200_OK)


class ProcessCsvView(APIView):
    """
    POST /api/carbon/process-csv/
    Accepts a JSON payload of pre-validated rows from Node.js and processes
    them with Pandas: outlier detection, missing value imputation, emission calc.

    Body: { "dataType": "energy|transport|material", "rows": [...] }
    """

    def post(self, request):
        data_type = request.data.get('dataType', '').lower()
        rows = request.data.get('rows', [])

        if data_type not in ('energy', 'transport', 'material'):
            return Response(
                {'error': 'dataType must be energy, transport, or material'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(rows, list) or len(rows) == 0:
            return Response(
                {'error': 'rows must be a non-empty list'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(rows) > 5000:
            return Response(
                {'error': 'Maximum 5,000 rows per upload. Please split your file.'},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        processor = CsvProcessorService()
        result = processor.process(data_type=data_type, rows=rows)

        if 'error' in result:
            return Response({'error': result['error']}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result, status=status.HTTP_200_OK)


class CalculateEmissionView(APIView):
    """
    POST /api/carbon/calculate/
    Calculates tCO2e from raw activity data using emission factors.
    """

    def post(self, request):
        serializer = ActivityDataSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid input', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data
        calculator = CarbonCalculator()
        result = calculator.calculate(
            activity_type=data['activityType'],
            value=data['value'],
            unit=data['unit'],
            country=data.get('country', 'Global'),
        )

        return Response(result, status=status.HTTP_200_OK)


class ForecastView(APIView):
    """
    GET /api/carbon/forecast/
    Returns ML-powered emission forecast for a supplier or entire portfolio.
    """

    def get(self, request):
        serializer = ForecastRequestSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid parameters', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        params = serializer.validated_data
        engine = MLEngine()
        forecast = engine.forecast(
            supplier_id=params.get('supplierId'),
            periods=params['periods'],
            frequency=params['frequency'],
        )

        return Response(forecast, status=status.HTTP_200_OK)


class RecommendationsView(APIView):
    """
    GET /api/carbon/recommendations/
    Returns AI-powered emission reduction recommendations.
    """

    def get(self, request):
        supplier_id = request.query_params.get('supplierId')
        engine = RecommendationEngine()
        recommendations = engine.get_recommendations(supplier_id=supplier_id)
        return Response(recommendations, status=status.HTTP_200_OK)


class SupplierScoreView(APIView):
    """
    POST /api/carbon/score/
    Calculates an ESG/carbon score for a supplier using an ML model.
    """

    def post(self, request):
        serializer = SupplierScoreSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid input', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data
        engine = MLEngine()
        score = engine.score_supplier(data)

        return Response(score, status=status.HTTP_200_OK)
